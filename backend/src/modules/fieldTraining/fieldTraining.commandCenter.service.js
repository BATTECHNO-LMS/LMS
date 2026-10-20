'use strict';

/**
 * Supervisor / Admin Command Center — operational attention queue.
 * Aggregates in batches to avoid N+1 (one qualification batch, one hours batch, etc.).
 */

const { ApiError, crossScopeForbidden } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { buildListMeta, normalizePagination } = require('../../utils/pagination');
const repo = require('./fieldTraining.repository');
const ftAccess = require('./fieldTraining.access');
const supervisorScope = require('./fieldTraining.supervisorScope');
const hoursMod = require('./fieldTraining.hours');
const taskProgress = require('./fieldTraining.taskProgress');
const qualificationService = require('./fieldTraining.qualification.service');
const officialMod = require('./fieldTraining.officialResult.service');
const progressBuilder = require('./fieldTraining.progress');
const lectureRepo = require('./fieldTraining.recordedLectures.repository');
const { mapStudentProgress, emptyStudentProgress } = require('./fieldTraining.recordedLectures.watch.service');
const {
  composeSnapshotFromProgressPayload,
  expectedHoursIfSupported,
} = require('./fieldTraining.progressSnapshot.service');
const { RISK_LEVELS } = require('./fieldTraining.risk');
const { READINESS_STATES } = require('./fieldTraining.readiness');

const SORT_ALLOWLIST = new Set([
  'highest_risk',
  'closest_to_completion',
  'lowest_score',
  'hours_remaining',
  'last_activity',
  'student_name',
]);

const RISK_RANK = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  NONE: 1,
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function matchesQuickFilter(row, quick) {
  if (!quick || quick === 'all') return true;
  if (quick === 'needs_attention') return row.risk.riskLevel !== RISK_LEVELS.NONE;
  if (quick === 'near_completion') return row.flags.near_completion;
  if (quick === 'not_ready') return row.readiness.state === READINESS_STATES.NOT_READY;
  if (quick === 'post_incomplete') {
    return (row.readiness.reasons || []).includes('POST_NOT_COMPLETED');
  }
  if (quick === 'tasks_overdue') {
    return (row.risk.signals || []).some((s) => s.code === 'TASKS_OVERDUE');
  }
  if (quick === 'low_attendance') {
    return (row.risk.signals || []).some((s) => s.code === 'LOW_ATTENDANCE');
  }
  if (quick === 'lectures_incomplete') {
    return (row.risk.signals || []).some(
      (s) =>
        s.code === 'RECORDED_LECTURE_NOT_STARTED' || s.code === 'RECORDED_LECTURE_INCOMPLETE'
    );
  }
  if (quick === 'ready_to_complete') return row.flags.ready_to_complete;
  if (quick === 'blocked') return row.flags.blocked;
  return true;
}

function compareRows(a, b, sort) {
  switch (sort) {
    case 'lowest_score': {
      const sa = a.score?.final ?? 999;
      const sb = b.score?.final ?? 999;
      return sa - sb || String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    }
    case 'hours_remaining': {
      const ha = a.hours_remaining ?? 0;
      const hb = b.hours_remaining ?? 0;
      return hb - ha || String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    }
    case 'last_activity': {
      const ta = a.last_meaningful_activity_at
        ? new Date(a.last_meaningful_activity_at).getTime()
        : 0;
      const tb = b.last_meaningful_activity_at
        ? new Date(b.last_meaningful_activity_at).getTime()
        : 0;
      return ta - tb || String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    }
    case 'student_name':
      return String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    case 'closest_to_completion': {
      const ra = a.flags.ready_to_complete ? 0 : a.flags.near_completion ? 1 : 2;
      const rb = b.flags.ready_to_complete ? 0 : b.flags.near_completion ? 1 : 2;
      return ra - rb || (b.score?.final ?? 0) - (a.score?.final ?? 0);
    }
    case 'highest_risk':
    default: {
      const ra = RISK_RANK[a.risk.riskLevel] || 0;
      const rb = RISK_RANK[b.risk.riskLevel] || 0;
      if (rb !== ra) return rb - ra;
      return String(a.student_name || '').localeCompare(String(b.student_name || ''), 'ar');
    }
  }
}

async function loadBatchActivity(applicationIds) {
  if (!applicationIds.length) return new Map();
  const [subs, att, attempts, lectures, apps] = await Promise.all([
    prisma.field_training_task_submissions.groupBy({
      by: ['application_id'],
      where: { application_id: { in: applicationIds } },
      _max: { submitted_at: true },
    }),
    prisma.field_training_attendance.groupBy({
      by: ['application_id'],
      where: { application_id: { in: applicationIds } },
      _max: { updated_at: true },
    }),
    prisma.field_training_assessment_attempts.groupBy({
      by: ['application_id'],
      where: { application_id: { in: applicationIds } },
      _max: { submitted_at: true, updated_at: true },
    }),
    prisma.field_training_recorded_lecture_progress.groupBy({
      by: ['application_id'],
      where: { application_id: { in: applicationIds } },
      _max: { last_watched_at: true, completed_at: true, updated_at: true },
    }),
    prisma.field_training_applications.findMany({
      where: { id: { in: applicationIds } },
      select: { id: true, hours_updated_at: true, training_started_at: true },
    }),
  ]);

  const map = new Map();
  const touch = (id, date) => {
    if (!date) return;
    const t = new Date(date).getTime();
    if (Number.isNaN(t)) return;
    const prev = map.get(id) || 0;
    if (t > prev) map.set(id, t);
  };

  for (const row of subs) touch(row.application_id, row._max.submitted_at);
  for (const row of att) touch(row.application_id, row._max.updated_at);
  for (const row of attempts) {
    touch(row.application_id, row._max.submitted_at);
    touch(row.application_id, row._max.updated_at);
  }
  for (const row of lectures) {
    touch(row.application_id, row._max.last_watched_at);
    touch(row.application_id, row._max.completed_at);
    touch(row.application_id, row._max.updated_at);
  }
  for (const row of apps) {
    touch(row.id, row.hours_updated_at);
    touch(row.id, row.training_started_at);
  }

  const out = new Map();
  for (const [id, t] of map) out.set(id, new Date(t).toISOString());
  return out;
}

async function loadOverdueByApplication(opportunityId, applicationIds) {
  const now = startOfToday();
  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId, is_required: true },
    select: { id: true, title: true, due_date: true },
  });
  const overdueTaskIds = tasks
    .filter((t) => t.due_date && new Date(t.due_date) < now)
    .map((t) => t.id);
  const allRequired = tasks;

  const submissions = await prisma.field_training_task_submissions.findMany({
    where: { application_id: { in: applicationIds } },
    select: { application_id: true, task_id: true },
  });
  const submittedByApp = new Map();
  for (const s of submissions) {
    if (!submittedByApp.has(s.application_id)) submittedByApp.set(s.application_id, new Set());
    submittedByApp.get(s.application_id).add(s.task_id);
  }

  const overdueByApp = new Map();
  const taskRowsByApp = new Map();
  for (const appId of applicationIds) {
    const submitted = submittedByApp.get(appId) || new Set();
    const overdue = overdueTaskIds
      .filter((id) => !submitted.has(id))
      .map((id) => {
        const t = tasks.find((x) => x.id === id);
        return { id, title: t?.title, due_date: t?.due_date };
      });
    overdueByApp.set(appId, overdue);
    taskRowsByApp.set(
      appId,
      allRequired.map((t) => ({
        id: t.id,
        title: t.title,
        is_required: true,
        due_date: t.due_date,
        submitted: submitted.has(t.id),
        overdue: Boolean(t.due_date && new Date(t.due_date) < now && !submitted.has(t.id)),
      }))
    );
  }
  return { overdueByApp, taskRowsByApp, tasks };
}

async function loadLecturesByApplication(opportunityId, applicationIds) {
  const lectures = await lectureRepo.listByOpportunity(opportunityId, { status: 'published' });
  if (!lectures.length) {
    return { lectures: [], byApp: new Map(applicationIds.map((id) => [id, []])) };
  }
  const progressRows = await prisma.field_training_recorded_lecture_progress.findMany({
    where: {
      application_id: { in: applicationIds },
      lecture_id: { in: lectures.map((l) => l.id) },
    },
  });
  const progressKey = (appId, lectureId) => `${appId}:${lectureId}`;
  const progressMap = new Map(
    progressRows.map((p) => [progressKey(p.application_id, p.lecture_id), p])
  );

  const byApp = new Map();
  for (const appId of applicationIds) {
    byApp.set(
      appId,
      lectures.map((lecture) => {
        const row = progressMap.get(progressKey(appId, lecture.id));
        const mapped = row
          ? mapStudentProgress(row, { durationSeconds: lecture.duration_seconds })
          : emptyStudentProgress();
        return {
          id: lecture.id,
          title: lecture.title,
          progress_percent: Number(mapped.progressPercentage || 0),
          completed_at: mapped.completedAt || null,
          available_at: lecture.published_at || lecture.lecture_date || lecture.created_at,
          published_at: lecture.published_at || null,
          created_at: lecture.created_at,
        };
      })
    );
  }
  return { lectures, byApp };
}

async function loadAttendanceMetrics(opportunityId, applicationIds) {
  const requiredSessions = await prisma.field_training_sessions.findMany({
    where: { opportunity_id: opportunityId, is_required: true },
    select: { id: true },
  });
  const sessionsCount = await prisma.field_training_sessions.count({
    where: { opportunity_id: opportunityId },
  });
  const requiredIds = requiredSessions.map((s) => s.id);
  const attendedByApp = new Map(applicationIds.map((id) => [id, 0]));
  if (requiredIds.length && applicationIds.length) {
    const rows = await prisma.field_training_attendance.groupBy({
      by: ['application_id'],
      where: {
        application_id: { in: applicationIds },
        session_id: { in: requiredIds },
        status: { in: ['present', 'late', 'excused'] },
      },
      _count: { _all: true },
    });
    for (const row of rows) attendedByApp.set(row.application_id, row._count._all);
  }
  return {
    sessionsCount,
    requiredSessionsCount: requiredIds.length,
    attendedByApp,
  };
}

/**
 * Opportunity-scoped command center.
 */
async function getOpportunityCommandCenter(opportunityId, query = {}, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opp);

  const requestedUniversityId = query.university_id || query.universityId || null;
  if (requestedUniversityId && ftAccess.isUniversityScopedFieldTrainingUser(user)) {
    if (String(user.universityId) !== String(requestedUniversityId)) {
      throw crossScopeForbidden('غير مصرح بالوصول إلى بيانات جامعة أخرى', {
        scopeType: 'university',
        code: 'FIELD_TRAINING_FORBIDDEN',
      });
    }
  }

  const studentUniversityId = ftAccess.resolveApplicationStudentUniversityId(
    user,
    requestedUniversityId
  );

  const apps = await repo.findApplicationsByOpportunity(opportunityId, {
    status: 'approved',
    university_id: requestedUniversityId || undefined,
    studentUniversityId,
    academicSupervisorWhere: supervisorScope.applicationSupervisorWhere(user),
  });

  const applicationIds = apps.map((a) => a.id);
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const [
    hoursByApp,
    progressByApp,
    qualRows,
    activityByApp,
    { overdueByApp, taskRowsByApp },
    { byApp: lecturesByApp },
    attendanceMetrics,
  ] = await Promise.all([
    hoursMod.calculateHoursProgressForApplications(
      apps.map((app) => ({ id: app.id, opportunity_id: opportunityId })),
      new Map([[opportunityId, opp.required_training_hours ?? null]])
    ),
    taskProgress.calculateTaskProgressForApplications(
      apps.map((app) => ({
        id: app.id,
        opportunity_id: opportunityId,
        student_id: app.student_id,
        status: app.status,
      })),
      { opportunitiesById: new Map([[opportunityId, opp]]) }
    ),
    qualificationService.calculateForApplications(applicationIds),
    loadBatchActivity(applicationIds),
    loadOverdueByApplication(opportunityId, applicationIds),
    loadLecturesByApplication(opportunityId, applicationIds),
    loadAttendanceMetrics(opportunityId, applicationIds),
  ]);

  const qualByApp = new Map(qualRows.map((r) => [r.applicationId, r]));
  const liveById = new Map(qualRows.map((r) => [r.applicationId, r]));
  const officialList = await officialMod.resolveFieldTrainingApprovedResults(applicationIds, {
    applications: apps,
    opportunities: new Map([[opportunityId, opp]]),
    liveById,
  });
  const officialMap = new Map(
    officialList.filter(Boolean).map((row) => [row.applicationId, row])
  );

  const rows = apps.map((app) => {
    const hours = hoursByApp.get(app.id);
    const tp = progressByApp.get(app.id);
    const qualRow = qualByApp.get(app.id);
    const official = officialMap.get?.(app.id);
    const qualification = official
      ? officialMod.toPublicQualificationFromOfficial(official, qualRow?.public)
      : qualRow?.public || null;

    const progress = progressBuilder.buildParticipantProgress(app, opp, {
      sessionsCount: attendanceMetrics.sessionsCount,
      requiredSessionsCount: attendanceMetrics.requiredSessionsCount,
      sessionsAttended: attendanceMetrics.attendedByApp.get(app.id) || 0,
      tasksCount: tp?.total_required ?? 0,
      tasksSubmitted: tp?.submitted_required ?? 0,
      hoursProgress: hours,
    });
    progress.task_progress = tp;
    if (progress.metrics) {
      progress.metrics.required_tasks_count = tp?.total_required ?? 0;
      progress.metrics.submitted_required_tasks_count = tp?.submitted_required ?? 0;
    }

    const snapshot = composeSnapshotFromProgressPayload({
      application: app,
      opportunity: opp,
      progress,
      hours,
      qualification,
      lectures: lecturesByApp.get(app.id) || [],
      overdueTasks: overdueByApp.get(app.id) || [],
      taskRows: taskRowsByApp.get(app.id) || [],
      lastMeaningfulActivityAt: activityByApp.get(app.id) || null,
      includeRisk: true,
    });

    const profile = profileById[app.student_id] || {};
    const hoursRemaining =
      snapshot.readiness?.completion_requirements?.hours?.remaining ??
      hours?.remaining_training_hours ??
      null;

    return {
      application_id: app.id,
      student_id: app.student_id,
      student_name: profile.full_name || profile.name || '—',
      student_number: profile.university_student_number || profile.student_number || null,
      university_id: profile.primary_university_id || null,
      university_name: profile.university_name || profile.university?.name || null,
      opportunity_id: opportunityId,
      opportunity_title: opp.title,
      training_status: app.training_status,
      readiness: {
        state: snapshot.readiness.state,
        state_label_ar: snapshot.readiness.state_label_ar,
        reasons: snapshot.readiness.reasons,
        explanation_ar: snapshot.readiness.explanation_ar,
      },
      risk: {
        riskLevel: snapshot.risk.riskLevel,
        risk_level_label_ar: snapshot.risk.risk_level_label_ar,
        primary_reason: snapshot.risk.primary_reason,
        primary_reason_label_ar: snapshot.risk.primary_reason_label_ar,
        explanations_ar: snapshot.risk.explanations_ar,
        signals: snapshot.risk.signals,
        recommended_action_ar: snapshot.risk.recommended_action_ar,
      },
      score: snapshot.readiness.score,
      hours_progress: {
        completed: hours?.completed_training_hours ?? null,
        required: hours?.required_training_hours ?? null,
        remaining: hoursRemaining,
        unit: 'hours',
      },
      hours_remaining: hoursRemaining,
      last_meaningful_activity_at: snapshot.last_meaningful_activity_at,
      next_action: snapshot.next_action,
      flags: snapshot.flags,
      lecture_summary: summarizeLectures(lecturesByApp.get(app.id) || []),
    };
  });

  const quick = query.quick_filter || query.quickFilter || 'all';
  const riskLevel = query.risk_level || query.riskLevel || null;
  const readinessState = query.readiness || query.completion_readiness || null;
  const reason = query.risk_reason || query.riskReason || null;
  const search = String(query.search || query.student || '').trim().toLowerCase();

  let filtered = rows.filter((row) => matchesQuickFilter(row, quick));
  if (riskLevel) {
    filtered = filtered.filter((r) => r.risk.riskLevel === String(riskLevel).toUpperCase());
  }
  if (readinessState) {
    filtered = filtered.filter((r) => r.readiness.state === String(readinessState).toUpperCase());
  }
  if (reason) {
    filtered = filtered.filter(
      (r) =>
        r.risk.primary_reason === reason ||
        (r.risk.signals || []).some((s) => s.code === reason) ||
        (r.readiness.reasons || []).includes(reason)
    );
  }
  if (search) {
    filtered = filtered.filter((r) =>
      `${r.student_name || ''} ${r.student_number || ''}`.toLowerCase().includes(search)
    );
  }

  const sort = SORT_ALLOWLIST.has(query.sort) ? query.sort : 'highest_risk';
  filtered.sort((a, b) => compareRows(a, b, sort));

  const { page, page_size, skip, take } = normalizePagination({
    page: query.page,
    page_size: query.page_size || query.pageSize || 25,
  });
  const pageRows = filtered.slice(skip, skip + take);

  const summary = buildSummary(rows);

  let logbookSummary = { pending: 0, revision_requested: 0, approved: 0, total: 0 };
  try {
    const logbookService = require('./fieldTraining.logbook.service');
    logbookSummary = await logbookService.getSummaryCountsForOpportunity(
      opportunityId,
      applicationIds
    );
  } catch {
    /* logbook tables may not be migrated yet in some local envs */
  }

  let interventionKpis = {
    open_cases: 0,
    high_critical_cases: 0,
    overdue_follow_ups: 0,
    resolved_this_month: 0,
    unassigned_cases: 0,
  };
  let casesByApp = new Map();
  try {
    const interventionService = require('./fieldTraining.intervention.service');
    interventionKpis = await interventionService.getKpis(opportunityId, user);
    const activeCases = await interventionService.getCasesForApplications(applicationIds);
    for (const c of activeCases) {
      if (!casesByApp.has(c.application_id)) casesByApp.set(c.application_id, []);
      casesByApp.get(c.application_id).push(c);
    }
  } catch {
    /* intervention tables may not be migrated yet */
  }

  const enrichedPageRows = pageRows.map((row) => {
    const cases = casesByApp.get(row.application_id) || [];
    const openCase = cases[0] || null;
    const highRiskNoCase =
      ['HIGH', 'CRITICAL'].includes(row.risk?.riskLevel) && cases.length === 0;
    return {
      ...row,
      intervention: {
        has_open_case: cases.length > 0,
        open_case: openCase
          ? {
              id: openCase.id,
              case_type: openCase.case_type,
              severity: openCase.severity,
              status: openCase.status,
              assigned_to_id: openCase.assigned_to_id,
              follow_up_at: openCase.follow_up_at,
              title: openCase.title,
            }
          : null,
        suggest_open_case: highRiskNoCase,
      },
    };
  });

  let liveAttendance = [];
  try {
    const openWindows = await prisma.field_training_attendance_windows.findMany({
      where: {
        status: 'open',
        field_training_sessions: { opportunity_id: opportunityId },
      },
      include: {
        field_training_sessions: { select: { id: true, title: true } },
      },
      take: 10,
    });
    liveAttendance = openWindows.map((w) => ({
      window_id: w.id,
      session_id: w.session_id,
      session_title: w.field_training_sessions?.title || null,
      expires_at: w.expires_at,
      remaining_seconds: w.expires_at
        ? Math.max(0, Math.floor((new Date(w.expires_at).getTime() - Date.now()) / 1000))
        : null,
    }));
  } catch {
    liveAttendance = [];
  }

  let externalPending = {
    pending_evaluations: 0,
    pending_hours: 0,
    active_assignments: 0,
  };
  try {
    const assignments = await prisma.field_training_external_supervisor_assignments.count({
      where: { opportunity_id: opportunityId, is_active: true },
    });
    externalPending.active_assignments = assignments;
    // Approximate pending hours/evals from attention queue flags
    externalPending.pending_hours = rows.filter(
      (r) => (r.hours_remaining != null && r.hours_remaining > 0) || false
    ).length;
    externalPending.pending_evaluations = rows.filter(
      (r) => (r.readiness?.reasons || []).includes('BEHAVIOR_INCOMPLETE') ||
        (r.readiness?.reasons || []).includes('SUPERVISOR_RATING_MISSING')
    ).length;
  } catch {
    /* ignore */
  }

  return {
    opportunity: {
      id: opp.id,
      title: opp.title,
      required_training_hours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
    },
    summary: {
      ...summary,
      logbook_pending: logbookSummary.pending,
      logbook_revision_requested: logbookSummary.revision_requested,
      logbook_approved: logbookSummary.approved,
      intervention_open: interventionKpis.open_cases,
      intervention_high_critical: interventionKpis.high_critical_cases,
      intervention_overdue_follow_ups: interventionKpis.overdue_follow_ups,
      intervention_unassigned: interventionKpis.unassigned_cases,
      live_attendance_windows: liveAttendance.length,
      external_pending_evaluations: externalPending.pending_evaluations,
      external_pending_hours: externalPending.pending_hours,
      external_active_assignments: externalPending.active_assignments,
    },
    live_attendance: liveAttendance,
    intervention_kpis: interventionKpis,
    external_supervisor_pending: externalPending,
    attention_queue: enrichedPageRows,
    meta: buildListMeta(filtered.length, page, page_size),
    filters_applied: {
      quick_filter: quick,
      risk_level: riskLevel,
      readiness: readinessState,
      risk_reason: reason,
      search: search || null,
      sort,
    },
    computed_at: new Date().toISOString(),
  };
}

function summarizeLectures(lectures) {
  if (!lectures.length) return null;
  const completed = lectures.filter((l) => l.completed_at || l.progress_percent >= 100).length;
  const notStarted = lectures.filter((l) => !l.completed_at && (l.progress_percent || 0) <= 0).length;
  const inProgress = lectures.length - completed - notStarted;
  return { total: lectures.length, completed, in_progress: inProgress, not_started: notStarted };
}

function buildSummary(rows) {
  const countSignal = (code) =>
    rows.filter((r) => (r.risk.signals || []).some((s) => s.code === code)).length;
  return {
    needs_attention: rows.filter((r) => r.risk.riskLevel !== RISK_LEVELS.NONE).length,
    low_attendance: countSignal('LOW_ATTENDANCE'),
    tasks_overdue: countSignal('TASKS_OVERDUE'),
    lectures_incomplete:
      countSignal('RECORDED_LECTURE_NOT_STARTED') + countSignal('RECORDED_LECTURE_INCOMPLETE'),
    post_incomplete: rows.filter((r) => (r.readiness.reasons || []).includes('POST_NOT_COMPLETED'))
      .length,
    near_completion: rows.filter((r) => r.flags.near_completion).length,
    ready_to_complete: rows.filter((r) => r.flags.ready_to_complete).length,
    blocked: rows.filter((r) => r.flags.blocked).length,
    total_scoped: rows.length,
  };
}

module.exports = {
  getOpportunityCommandCenter,
  SORT_ALLOWLIST,
  buildSummary,
  expectedHoursIfSupported,
};
