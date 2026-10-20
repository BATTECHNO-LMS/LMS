'use strict';

/**
 * Canonical Field Training progress snapshot for one application.
 * Powers Journey, Readiness, Next Action, Risk, Command Center detail, reports.
 */

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const repo = require('./fieldTraining.repository');
const ftAccess = require('./fieldTraining.access');
const supervisorScope = require('./fieldTraining.supervisorScope');
const {
  resolveFieldTrainingReadiness,
  resolveStudentNextAction,
} = require('./fieldTraining.readiness');
const { buildFieldTrainingJourney } = require('./fieldTraining.journey');
const { evaluateFieldTrainingRisk } = require('./fieldTraining.risk');
const lectureRepo = require('./fieldTraining.recordedLectures.repository');
const { mapStudentProgress, emptyStudentProgress } = require('./fieldTraining.recordedLectures.watch.service');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadOverdueTasksForApplication(applicationId, opportunityId, studentId) {
  const now = startOfToday();
  const allRequired = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId, is_required: true },
    select: { id: true, title: true, due_date: true, is_required: true, sort_order: true },
    orderBy: { sort_order: 'asc' },
  });

  const submissions = await prisma.field_training_task_submissions.findMany({
    where: { application_id: applicationId },
    select: { task_id: true, review_status: true, submitted_at: true },
  });
  const submittedIds = new Set(submissions.map((s) => s.task_id));

  const taskRows = allRequired.map((t) => ({
    id: t.id,
    title: t.title,
    is_required: true,
    due_date: t.due_date,
    submitted: submittedIds.has(t.id),
    overdue: Boolean(t.due_date && new Date(t.due_date) < now && !submittedIds.has(t.id)),
  }));

  const overdue = taskRows
    .filter((t) => t.overdue)
    .map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }));

  return { overdue, allRequired: taskRows, studentId };
}

async function loadLecturesForStudent(opportunityId, applicationId) {
  const visible = await lectureRepo.listByOpportunity(opportunityId, { status: 'published' });
  if (!visible.length) return [];

  const progressRows = await prisma.field_training_recorded_lecture_progress.findMany({
    where: {
      application_id: applicationId,
      lecture_id: { in: visible.map((l) => l.id) },
    },
  });
  const byLecture = new Map(progressRows.map((p) => [p.lecture_id, p]));

  return visible.map((lecture) => {
    const progress = byLecture.get(lecture.id);
    const mapped = progress
      ? mapStudentProgress(progress, { durationSeconds: lecture.duration_seconds })
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
  });
}

async function resolveLastMeaningfulActivityAt(applicationId) {
  const [submission, attendance, attempt, lectureProgress, app] = await Promise.all([
    prisma.field_training_task_submissions.findFirst({
      where: { application_id: applicationId },
      orderBy: { submitted_at: 'desc' },
      select: { submitted_at: true },
    }),
    prisma.field_training_attendance.findFirst({
      where: { application_id: applicationId },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    }),
    prisma.field_training_assessment_attempts.findFirst({
      where: { application_id: applicationId },
      orderBy: { submitted_at: 'desc' },
      select: { submitted_at: true, updated_at: true },
    }),
    prisma.field_training_recorded_lecture_progress.findFirst({
      where: { application_id: applicationId },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true, completed_at: true, last_watched_at: true },
    }),
    prisma.field_training_applications.findUnique({
      where: { id: applicationId },
      select: { hours_updated_at: true, training_started_at: true },
    }),
  ]);

  const candidates = [
    submission?.submitted_at,
    attendance?.updated_at,
    attempt?.submitted_at || attempt?.updated_at,
    lectureProgress?.last_watched_at || lectureProgress?.completed_at || lectureProgress?.updated_at,
    app?.hours_updated_at,
    app?.training_started_at,
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((n) => !Number.isNaN(n));

  if (!candidates.length) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

function expectedHoursIfSupported(opp, app, completedHours) {
  const required = opp.required_training_hours != null ? Number(opp.required_training_hours) : null;
  const start = app.training_started_at ? new Date(app.training_started_at) : null;
  const end = opp.end_date ? new Date(opp.end_date) : null;
  if (
    required == null ||
    required <= 0 ||
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return { supported: false, expected: null, completed: completedHours ?? null };
  }
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return { supported: false, expected: null, completed: completedHours ?? null };
  const elapsed = Math.min(Math.max(Date.now() - start.getTime(), 0), totalMs);
  const expected = Math.round(required * (elapsed / totalMs) * 100) / 100;
  return { supported: true, expected, completed: completedHours ?? 0 };
}

function composeSnapshotFromProgressPayload({
  application,
  opportunity,
  progress,
  hours,
  qualification,
  lectures = [],
  overdueTasks = [],
  taskRows = [],
  lastMeaningfulActivityAt = null,
  includeRisk = true,
}) {
  const app = application || progress?.application || {};
  const opp = opportunity || progress?.opportunity || {};
  const metrics = progress?.metrics || {};
  const hoursRow = hours || progress?.hours || {};

  const readiness = resolveFieldTrainingReadiness({
    application: app,
    opportunity: opp,
    qualification,
    hours: hoursRow,
    progressMetrics: metrics,
  });

  const nextAction = resolveStudentNextAction({
    readiness,
    progressNextAction: progress?.next_action,
    lectures,
    overdueTasks,
  });

  const journey = buildFieldTrainingJourney({
    application: app,
    opportunity: opp,
    progressMetrics: metrics,
    hours: hoursRow,
    taskProgress: progress?.task_progress,
    tasks: taskRows,
    lectures,
    sessions: {
      count: metrics.sessions_count,
      requiredCount: metrics.required_sessions_count,
      attended: metrics.sessions_attended,
    },
    readiness,
    qualification,
  });

  const completedHours = Number(
    hoursRow.completed_training_hours ?? metrics.completed_training_hours ?? 0
  );
  const expectedHoursProgress = expectedHoursIfSupported(opp, app, completedHours);

  const attendanceAbsent =
    Number(metrics.required_sessions_count || 0) > 0
      ? Math.max(
          0,
          Number(metrics.required_sessions_count) - Number(metrics.sessions_attended || 0)
        )
      : 0;

  const risk = includeRisk
    ? evaluateFieldTrainingRisk({
        application: app,
        opportunity: opp,
        readiness,
        qualification,
        overdueTasks,
        pendingRequiredTasksCount: Math.max(
          0,
          Number(metrics.required_tasks_count || 0) -
            Number(metrics.submitted_required_tasks_count || 0)
        ),
        attendance: {
          percentage: metrics.attendance_percentage,
          absentCount: attendanceAbsent,
          requiredCount: metrics.required_sessions_count,
          minimumPercentage: opp.minimum_attendance_percentage,
        },
        lectures,
        lastMeaningfulActivityAt,
        expectedHoursProgress,
      })
    : null;

  const nearCompletion =
    readiness.state === 'NEARLY_READY' ||
    (readiness.state === 'NOT_READY' &&
      readiness.score?.passed &&
      (readiness.reasons || []).filter((r) => r !== 'TRAINING_NOT_STARTED').length <= 2);

  const readyToComplete =
    readiness.state === 'READY' ||
    (app.completion_eligibility_status === 'eligible' && !app.completion_letter_issued_at);

  return {
    application_id: app.id,
    opportunity_id: opp.id || app.opportunity_id,
    readiness,
    journey,
    next_action: nextAction,
    risk,
    qualification,
    hours: hoursRow,
    lectures,
    overdue_tasks: overdueTasks,
    last_meaningful_activity_at: lastMeaningfulActivityAt,
    flags: {
      near_completion: Boolean(nearCompletion),
      ready_to_complete: Boolean(readyToComplete),
      blocked:
        readiness.state === 'NOT_READY' &&
        (readiness.reasons || []).some((r) =>
          [
            'SCORE_BELOW_THRESHOLD',
            'HOURS_INCOMPLETE',
            'POST_NOT_COMPLETED',
            'TASKS_PENDING',
            'BEHAVIOR_PENDING',
          ].includes(r)
        ),
    },
    computed_at: new Date().toISOString(),
  };
}

async function getFieldTrainingStudentProgressSnapshot(applicationId, user, options = {}) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  if (user) {
    const roles = (user.roles || []).map((r) => String(r).toLowerCase());
    const isStudentSelf =
      roles.includes('student') && String(user.userId) === String(app.student_id);
    if (isStudentSelf) {
      if (String(user.userId) !== String(app.student_id)) {
        throw new ApiError(403, 'غير مصرح بالوصول إلى تقدم طالب آخر');
      }
    } else {
      await ftAccess.assertManageOpportunityAccess(user, opp);
      await supervisorScope.assertReviewerCanAccessApplication(user, app);
      await ftAccess.assertApplicationStudentAccess(user, app.student_id);
    }
  }

  const workflowService = require('./fieldTraining.workflowService');
  const payload = await workflowService.getStudentOpportunityProgress(opp.id, app.student_id);
  if (!payload?.progress) {
    throw new ApiError(404, 'Progress not found');
  }

  const [{ overdue, allRequired }, lectures, lastMeaningfulActivityAt] = await Promise.all([
    loadOverdueTasksForApplication(app.id, opp.id, app.student_id),
    loadLecturesForStudent(opp.id, app.id),
    resolveLastMeaningfulActivityAt(app.id),
  ]);

  return composeSnapshotFromProgressPayload({
    application: app,
    opportunity: opp,
    progress: payload.progress,
    hours: payload.hours,
    qualification: payload.qualification,
    lectures,
    overdueTasks: overdue,
    taskRows: allRequired,
    lastMeaningfulActivityAt,
    includeRisk: options.includeRisk !== false,
  });
}

async function enrichStudentProgressPayload(opportunityId, studentId, payload) {
  if (!payload?.progress) return payload;
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app) return payload;
  const opp = (await repo.findPublishedById(opportunityId)) || (await repo.findById(opportunityId));

  const [{ overdue, allRequired }, lectures, lastMeaningfulActivityAt] = await Promise.all([
    loadOverdueTasksForApplication(app.id, opportunityId, studentId),
    loadLecturesForStudent(opportunityId, app.id),
    resolveLastMeaningfulActivityAt(app.id),
  ]);

  const snapshot = composeSnapshotFromProgressPayload({
    application: app,
    opportunity: opp,
    progress: payload.progress,
    hours: payload.hours,
    qualification: payload.qualification,
    lectures,
    overdueTasks: overdue,
    taskRows: allRequired,
    lastMeaningfulActivityAt,
    includeRisk: false,
  });

  return {
    ...payload,
    progress: {
      ...payload.progress,
      next_action: snapshot.next_action,
    },
    readiness: snapshot.readiness,
    journey: snapshot.journey,
    next_action: snapshot.next_action,
    lectures_progress: lectures,
    snapshot_computed_at: snapshot.computed_at,
  };
}

module.exports = {
  getFieldTrainingStudentProgressSnapshot,
  composeSnapshotFromProgressPayload,
  enrichStudentProgressPayload,
  loadOverdueTasksForApplication,
  loadLecturesForStudent,
  resolveLastMeaningfulActivityAt,
  expectedHoursIfSupported,
};
