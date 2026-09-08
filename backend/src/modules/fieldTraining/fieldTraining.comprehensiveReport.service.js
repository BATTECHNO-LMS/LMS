'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const repo = require('./fieldTraining.repository');
const ftAccess = require('./fieldTraining.access');
const hoursMod = require('./fieldTraining.hours');
const qualificationService = require('./fieldTraining.qualification.service');
const {
  PROFESSIONAL_CRITERIA,
  ACCEPTED_TASK_STATUSES,
} = require('./fieldTrainingEvaluation.constants');
const {
  LOGIN_ACTION,
  STUDENT_ACTIVITY_ACTIONS,
  translateStudentActivityEvent,
  CATEGORY,
} = require('./fieldTraining.activityTranslate');

const ATTENDANCE_STATUS_AR = Object.freeze({
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'غياب بعذر',
  unconfirmed: 'لم يتم تسجيل الحالة',
});

const REVIEW_STATUS_AR = Object.freeze({
  approved: 'تم اعتماد المهمة',
  graded: 'تم تقييم المهمة',
  submitted: 'تم تسليم المهمة',
  under_review: 'قيد المراجعة',
  pending: 'لم يتم التقييم بعد',
  needs_revision: 'تحتاج إعادة تسليم',
  rejected: 'تحتاج إعادة تسليم',
  not_submitted: 'لم يتم التسليم',
  missing: 'لم يتم التسليم',
});

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  const n = num(value);
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function formatDateTimeAr(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function formatDateAr(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function gateLabel(ok) {
  if (ok === true) return { status: 'passed', labelAr: 'اجتاز' };
  if (ok === false) return { status: 'failed', labelAr: 'لم يجتز' };
  return { status: 'unknown', labelAr: 'غير متوفر' };
}

function completeLabel(ok) {
  if (ok === true) return { status: 'complete', labelAr: 'مكتمل' };
  if (ok === false) return { status: 'incomplete', labelAr: 'غير مكتمل' };
  return { status: 'unknown', labelAr: 'غير متوفر' };
}

function buildQualificationSummary(publicQ, calculated) {
  const finalScore = publicQ?.finalScore ?? null;
  const passing = publicQ?.passingScore ?? 80;
  const diff = finalScore == null ? null : round1(finalScore - passing);
  const gates = calculated?.mandatoryRequirements || publicQ?.mandatoryRequirements || {};
  return {
    finalScore,
    passingScore: passing,
    scoreDifference: diff,
    scoreDifferenceLabelAr:
      diff == null
        ? null
        : diff >= 0
          ? `تجاوز حد التأهيل بـ ${diff} علامات`
          : `ناقص ${Math.abs(diff)} علامات عن حد التأهيل`,
    eligibilityStatus: publicQ?.eligibilityStatus || null,
    workflowOutcome: publicQ?.workflowOutcome || null,
    scorePassed: Boolean(publicQ?.scorePassed),
    scoreStatus: publicQ?.scoreStatus || null,
    scoreComponents: publicQ?.scoreComponents || null,
    eligibilityReasons: publicQ?.eligibilityReasons || [],
    eligibilityReasonLabels: publicQ?.eligibilityReasonLabels || [],
    zeroParticipationApplied: Boolean(publicQ?.zeroParticipationApplied),
    zeroParticipationPolicyCode: publicQ?.zeroParticipationPolicyCode || null,
    eligibilityOverride: publicQ?.eligibilityOverride || null,
    recordedAttendancePercent: publicQ?.recordedAttendancePercent ?? null,
    submittedRequiredTaskCount: publicQ?.submittedRequiredTaskCount ?? null,
    approvedEvaluationResult: publicQ?.approvedEvaluationResult || null,
    scoreBreakdown: publicQ?.scoreBreakdown || publicQ?.approvedEvaluationResult?.scoreBreakdown || null,
    recalculatedScore: publicQ?.recalculatedScore ?? null,
    mandatoryGates: [
      {
        key: 'attendance',
        nameAr: 'متطلب الحضور',
        ...gateLabel(gates.attendanceRequirementMet),
      },
      {
        key: 'hours',
        nameAr: 'متطلب الساعات',
        ...gateLabel(gates.hoursRequirementMet),
      },
      {
        key: 'preAssessment',
        nameAr: 'التقييم القبلي',
        ...completeLabel(gates.preAssessmentCompleted),
      },
      {
        key: 'postAssessment',
        nameAr: 'التقييم البعدي',
        ...completeLabel(gates.postAssessmentCompleted),
      },
      {
        key: 'tasks',
        nameAr: 'التاسكات المطلوبة',
        ...completeLabel(gates.requiredTasksCompleted),
      },
      {
        key: 'behavior',
        nameAr: 'التقييم المهني / السلوك',
        ...completeLabel(gates.behaviorEvaluationComplete),
      },
      {
        key: 'finalScore',
        nameAr: 'حد العلامة النهائية',
        ...gateLabel(gates.scorePassed),
      },
    ],
    confirmedPasses: [
      gates.scorePassed ? 'حقق العلامة المطلوبة' : null,
      gates.hoursRequirementMet ? 'استكمل الساعات' : null,
      gates.attendanceRequirementMet ? 'حقق متطلبات الحضور' : null,
      gates.requiredTasksCompleted ? 'استكمل التاسكات' : null,
      gates.preAssessmentCompleted && gates.postAssessmentCompleted
        ? 'استكمل التقييم القبلي والبعدي'
        : null,
      gates.behaviorEvaluationComplete ? 'استكمل التقييم المهني' : null,
    ].filter(Boolean),
  };
}

async function loadStudentActivity({ studentId, applicationId, opportunityId, limit = 100 }) {
  const take = Math.min(200, Math.max(20, Number(limit) || 100));
  let rows = [];
  try {
    rows = await prisma.audit_logs.findMany({
      where: {
        action_type: { in: [...STUDENT_ACTIVITY_ACTIONS] },
        OR: [
          { user_id: studentId },
          { entity_id: studentId },
          { entity_id: applicationId },
          { entity_id: opportunityId },
        ],
      },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        user_id: true,
        action_type: true,
        entity_type: true,
        entity_id: true,
        new_values: true,
        created_at: true,
      },
    });
  } catch {
    rows = [];
  }

  // Keep only events that are about this student/application when the entity is an opportunity-level action.
  rows = rows.filter((row) => {
    if (row.action_type === LOGIN_ACTION) {
      return row.user_id === studentId || row.entity_id === studentId;
    }
    if (row.entity_id === applicationId || row.entity_id === studentId) return true;
    const nv = row.new_values && typeof row.new_values === 'object' ? row.new_values : {};
    if (String(nv.applicationId || nv.application_id || '') === String(applicationId)) return true;
    if (String(nv.studentId || nv.student_id || '') === String(studentId)) return true;
    // Opportunity-scoped events that don't name the student are noisy — skip unless entity is application.
    if (row.entity_id === opportunityId) {
      return ['FIELD_TRAINING_STARTED', 'FIELD_TRAINING_ASSESSMENT_PUBLISHED'].includes(row.action_type) === false
        ? Boolean(nv.applicationId || nv.studentId)
        : false;
    }
    return row.user_id === studentId;
  });

  const firstLoginAudit = await prisma.audit_logs
    .findFirst({
      where: {
        action_type: LOGIN_ACTION,
        OR: [{ user_id: studentId }, { entity_id: studentId }],
      },
      orderBy: { created_at: 'asc' },
      select: { created_at: true },
    })
    .catch(() => null);

  const trackingExists = Boolean(firstLoginAudit);
  const loginCount = trackingExists
    ? await prisma.audit_logs
        .count({
          where: {
            action_type: LOGIN_ACTION,
            OR: [{ user_id: studentId }, { entity_id: studentId }],
          },
        })
        .catch(() => 0)
    : null;

  const student = await prisma.users.findUnique({
    where: { id: studentId },
    select: { last_login_at: true, created_at: true },
  });

  const timeline = rows.map((row) => {
    const translated = translateStudentActivityEvent(row);
    return {
      id: row.id,
      at: row.created_at,
      atLabelAr: formatDateTimeAr(row.created_at),
      title: translated.title,
      description: translated.description,
      category: translated.category,
      categoryLabelAr: translated.categoryLabelAr,
    };
  });

  return {
    summary: {
      loginCount,
      loginCountAvailable: trackingExists,
      loginCountLabelAr: trackingExists
        ? `${loginCount} مرة`
        : 'غير متوفر تاريخياً قبل تفعيل التتبع',
      firstLoginAt: firstLoginAudit?.created_at || null,
      firstLoginAtLabelAr: formatDateTimeAr(firstLoginAudit?.created_at),
      lastLoginAt: student?.last_login_at || null,
      lastLoginAtLabelAr: formatDateTimeAr(student?.last_login_at),
      firstActivityAt: timeline.length
        ? timeline[timeline.length - 1]?.at
        : student?.created_at || null,
      firstActivityAtLabelAr: formatDateTimeAr(
        timeline.length ? timeline[timeline.length - 1]?.at : student?.created_at
      ),
      trackingEnabled: trackingExists,
    },
    timeline,
  };
}

async function getComprehensiveStudentReport(opportunityId, applicationId, user, query = {}) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  if (String(app.opportunity_id) !== String(opportunityId)) {
    throw new ApiError(404, 'Application not found for this opportunity');
  }
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opp);
  await ftAccess.assertApplicationStudentAccess(user, app.student_id);

  const [profiles, qualRow, sessions, tasks, submissions, attendanceRows, attempts, ratings, hoursProgress] =
    await Promise.all([
      repo.findStudentProfilesByIds([app.student_id]),
      qualificationService.calculateForApplication(applicationId),
      prisma.field_training_sessions.findMany({
        where: { opportunity_id: opportunityId },
        orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
        select: {
          id: true,
          title: true,
          session_date: true,
          start_time: true,
          end_time: true,
          is_required: true,
        },
      }),
      prisma.field_training_tasks.findMany({
        where: { opportunity_id: opportunityId },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          title: true,
          is_required: true,
          is_final_task: true,
          grading_mode: true,
          due_date: true,
        },
      }),
      prisma.field_training_task_submissions.findMany({
        where: { application_id: applicationId },
        orderBy: { submitted_at: 'desc' },
      }),
      prisma.field_training_attendance.findMany({
        where: { application_id: applicationId },
        select: {
          session_id: true,
          status: true,
          recorded_at: true,
          note: true,
        },
      }),
      prisma.field_training_assessment_attempts.findMany({
        where: { application_id: applicationId },
        include: {
          field_training_assessments: { select: { id: true, type: true, title: true } },
        },
      }),
      prisma.field_training_supervisor_ratings.findMany({
        where: { application_id: applicationId },
        orderBy: { rated_at: 'desc' },
        take: 1,
      }),
      hoursMod.calculateHoursProgressForApplication(applicationId, opp.required_training_hours),
    ]);

  const profile = profiles[0] || null;
  let publicQ = qualificationService.toPublicQualification(qualRow?.calculated);
  const approvedMod = require('./fieldTraining.tafilaApprovedResult.service');
  const approvedStored = app.eligibility_reason?.details?.approvedEvaluationResult || null;
  if (approvedStored) {
    publicQ = approvedMod.applyApprovedDisplayToQualification(
      {
        ...publicQ,
        eligibilityReasonLabels: Array.isArray(app.eligibility_reason?.labelsAr)
          ? app.eligibility_reason.labelsAr
          : publicQ?.eligibilityReasonLabels,
      },
      {
        ...(app.eligibility_reason?.details || {}),
        labelsAr: app.eligibility_reason?.labelsAr,
        approvedEvaluationResult: approvedStored,
      },
      app.opportunity_id
    );
  }
  const calculated = qualRow?.calculated;
  const qualification = buildQualificationSummary(publicQ, calculated);

  const attendanceBySession = Object.fromEntries(attendanceRows.map((r) => [r.session_id, r]));
  const sessionDetails = sessions.map((session) => {
    const row = attendanceBySession[session.id];
    const status = row?.status || 'unconfirmed';
    const minutes = hoursMod.sessionDurationMinutes(session.start_time, session.end_time);
    return {
      sessionId: session.id,
      title: session.title,
      date: session.session_date,
      dateLabelAr: formatDateAr(session.session_date),
      isRequired: session.is_required !== false,
      status,
      statusLabelAr: ATTENDANCE_STATUS_AR[status] || ATTENDANCE_STATUS_AR.unconfirmed,
      durationHours: minutes != null ? round1(minutes / 60) : null,
    };
  });
  const counts = sessionDetails.reduce(
    (acc, row) => {
      if (row.status === 'present') acc.present += 1;
      else if (row.status === 'absent') acc.absent += 1;
      else if (row.status === 'late') acc.late += 1;
      else if (row.status === 'excused') acc.excused += 1;
      else acc.unmarked += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 }
  );
  const requiredSessions = sessions.filter((s) => s.is_required !== false).length;
  const attendedLike = counts.present + counts.late + counts.excused;

  const subByTask = new Map();
  for (const sub of submissions) {
    if (!subByTask.has(sub.task_id)) subByTask.set(sub.task_id, sub);
  }
  const requiredTasks = tasks.filter((t) => t.is_required !== false);
  const approvedTaskDetails =
    approvedStored?.approvedTaskEvaluation?.details ||
    publicQ?.approvedEvaluationResult?.approvedTaskEvaluation?.details ||
    [];
  const approvedByTaskId = Object.fromEntries(
    approvedTaskDetails.filter((d) => d.taskId).map((d) => [d.taskId, d])
  );
  const taskRows = requiredTasks.map((task) => {
    const sub = subByTask.get(task.id);
    const reviewStatus = sub?.review_status || (sub ? 'pending' : 'missing');
    const approvedDetail =
      approvedByTaskId[task.id] ||
      approvedTaskDetails.find((d) => d.title && d.title === task.title) ||
      null;
    const canonicalScore = sub?.manual_score != null ? Number(sub.manual_score) : null;
    const isGraded = ['graded', 'approved'].includes(String(reviewStatus));
    const approvedTaskScore =
      canonicalScore != null && isGraded
        ? canonicalScore
        : approvedDetail?.approvedTaskScore != null
          ? Number(approvedDetail.approvedTaskScore)
          : null;
    const submitted =
      Boolean(sub) ||
      approvedDetail?.submissionStatus === 'SUBMITTED' ||
      ['submitted', 'under_review', 'graded', 'approved', 'needs_revision', 'pending'].includes(
        String(reviewStatus)
      );
    return {
      taskId: task.id,
      title: task.title,
      isFinalTask: Boolean(task.is_final_task),
      dueDate: task.due_date,
      dueDateLabelAr: formatDateAr(task.due_date),
      reviewStatus,
      submissionStatus: submitted
        ? approvedDetail?.submissionStatus || (isGraded ? 'SUBMITTED' : reviewStatus)
        : 'NOT_SUBMITTED',
      submissionStatusLabelAr: submitted
        ? approvedDetail?.submissionStatusAr || REVIEW_STATUS_AR[reviewStatus] || 'مسلّم'
        : 'غير مسلّم',
      submittedAt: sub?.submitted_at || null,
      submittedAtLabelAr: formatDateTimeAr(sub?.submitted_at),
      isLate: Boolean(sub?.is_late),
      score: canonicalScore,
      rawTaskScore:
        approvedDetail?.rawTaskScore != null
          ? Number(approvedDetail.rawTaskScore)
          : canonicalScore,
      approvedTaskScore,
      approvedSourceLabelAr: submitted
        ? approvedDetail?.source === 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT'
          ? 'تقييم نهائي معتمد للدفعة السابقة'
          : approvedDetail?.source === 'AUTHORIZED_MANUAL_REVIEW' || isGraded
            ? 'مراجعة واعتماد نهائي'
            : approvedDetail?.source
              ? 'تقييم معتمد'
              : isGraded
                ? 'مراجعة واعتماد نهائي'
                : null
        : null,
      maxScore: sub?.max_score != null ? Number(sub.max_score) : canonicalScore != null ? 100 : null,
      accepted: isGraded || ACCEPTED_TASK_STATUSES.includes(reviewStatus),
    };
  });

  const findAttempt = (type) =>
    attempts.find((a) => a.field_training_assessments?.type === type) || null;
  const mapAttempt = (attempt, fallbackScore) => {
    const score = attempt?.score != null ? Number(attempt.score) : num(fallbackScore);
    return {
      completed: score != null || Boolean(attempt?.submitted_at),
      statusLabelAr: score != null || attempt?.submitted_at ? 'مكتمل' : 'غير مكتمل',
      score,
      maxScore: attempt?.max_score != null ? Number(attempt.max_score) : score != null ? 100 : null,
      submittedAt: attempt?.submitted_at || null,
      submittedAtLabelAr: formatDateTimeAr(attempt?.submitted_at),
    };
  };

  const criteria = PROFESSIONAL_CRITERIA.map((c) => {
    const score = calculated?.[`criterion${c.index}Score`] ?? null;
    return {
      index: c.index,
      key: c.key,
      labelAr: c.labelAr,
      score,
      maxScore: 5,
    };
  });

  const activity = await loadStudentActivity({
    studentId: app.student_id,
    applicationId,
    opportunityId,
    limit: Number(query.activity_limit) || 80,
  });

  const categoryFilter = String(query.activity_category || '').toUpperCase();
  const filteredTimeline =
    categoryFilter && CATEGORY[categoryFilter]
      ? activity.timeline.filter((row) => row.category === categoryFilter)
      : activity.timeline;

  return {
    generatedAt: new Date().toISOString(),
    generatedAtLabelAr: formatDateTimeAr(new Date()),
    student: {
      id: app.student_id,
      fullName: profile?.full_name || null,
      email: profile?.email || null,
      phone: profile?.phone || null,
      university: profile?.university?.name || null,
      specialty: repo.formatSpecialtyLabel(
        profile?.university_specialty || profile?.specialty,
        null
      ),
      universityNumber: profile?.university_student_number || null,
    },
    opportunity: {
      id: opp.id,
      title: opp.title,
      organizationName: opp.organization_name || null,
      trainingMode: opp.training_mode || null,
      trainingModeAr:
        opp.training_mode === 'remote'
          ? 'عن بعد'
          : opp.training_mode === 'onsite'
            ? 'وجاهي'
            : opp.training_mode || null,
      startDate: opp.start_date,
      endDate: opp.end_date,
      startDateLabelAr: formatDateAr(opp.start_date),
      endDateLabelAr: formatDateAr(opp.end_date),
      academicYear: null,
      semester: null,
      requiredTrainingHours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
      minimumAttendancePercentage:
        opp.minimum_attendance_percentage != null
          ? Number(opp.minimum_attendance_percentage)
          : null,
      requiresFinalTask: Boolean(opp.requires_final_task),
    },
    application: {
      id: app.id,
      status: app.status,
      trainingStatus: app.training_status,
      eligibilityStatus: app.completion_eligibility_status,
      academicSupervisorName: app.academic_supervisor_name || null,
    },
    eligibility: qualification,
    scoring: {
      components: publicQ?.scoreComponents || null,
      finalScore: publicQ?.finalScore ?? null,
      passingScore: publicQ?.passingScore ?? 80,
      weights: publicQ?.weights || null,
      policyCode: publicQ?.policyCode || null,
    },
    attendance: {
      percentage: num(app.attendance_percentage),
      requiredSessions,
      attended: attendedLike,
      counts,
      completedHours: hoursProgress?.completed_training_hours ?? num(app.completed_training_hours),
      requiredHours:
        hoursProgress?.required_training_hours ??
        (opp.required_training_hours != null ? Number(opp.required_training_hours) : null),
      sessions: sessionDetails,
    },
    tasks: {
      requiredCount: taskRows.length,
      completedCount: taskRows.filter((t) => t.accepted).length,
      items: taskRows,
    },
    assessments: {
      pre: mapAttempt(findAttempt('pre'), app.pre_assessment_score),
      post: mapAttempt(findAttempt('post'), app.post_assessment_score),
    },
    professionalEvaluation: {
      criteria,
      professionalTotal: calculated?.professionalTotal ?? null,
      professionalMax: 50,
      professionalPercentage: calculated?.professionalPercentage ?? null,
      behaviorPoints: publicQ?.scoreComponents?.behavior?.points ?? null,
      behaviorMax: publicQ?.scoreComponents?.behavior?.maxPoints ?? 20,
      ratedAt: ratings[0]?.rated_at || null,
      ratedAtLabelAr: formatDateTimeAr(ratings[0]?.rated_at),
    },
    activitySummary: {
      ...activity.summary,
      taskSubmissionsCount: taskRows.filter((t) => t.submissionStatus !== 'missing').length,
      requiredTasksCount: taskRows.length,
      attendanceEventsCount: attendedLike,
      requiredSessionsCount: requiredSessions,
      assessmentsCompletedCount:
        (mapAttempt(findAttempt('pre'), app.pre_assessment_score).completed ? 1 : 0) +
        (mapAttempt(findAttempt('post'), app.post_assessment_score).completed ? 1 : 0),
      assessmentsRequiredCount:
        (opp.requires_pre_assessment !== false ? 1 : 0) + (opp.requires_post_assessment !== false ? 1 : 0),
    },
    activityTimeline: filteredTimeline,
  };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(value) {
  if (value == null || value === '') return '—';
  return esc(value);
}

function kpi(label, value) {
  return `<div class="kpi"><div class="kpi__label">${esc(label)}</div><div class="kpi__value">${dash(value)}</div></div>`;
}

function section(title, body, id = '') {
  return `<section class="section"${id ? ` id="${esc(id)}"` : ''}><h2>${esc(title)}</h2>${body}</section>`;
}

function kv(pairs) {
  return `<div class="kv">${pairs
    .map(([k, v]) => `<div>${esc(k)}</div><div>${dash(v)}</div>`)
    .join('')}</div>`;
}

function table(headers, rows, { empty = 'لا توجد بيانات.' } = {}) {
  if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${dash(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  const ok = s === 'eligible' || s === 'مؤهل';
  const bad = s === 'ineligible' || s === 'not_eligible' || s === 'غير مؤهل';
  const cls = ok ? 'badge badge--ok' : bad ? 'badge badge--bad' : 'badge badge--warn';
  const label =
    ok ? 'مؤهل' : bad ? 'غير مؤهل' : status || '—';
  return `<span class="${cls}">${esc(label)}</span>`;
}

function renderComprehensiveReportHtml(report, assets = {}) {
  const {
    loadFontFaceCss,
    loadLogoDataUri,
    FONT_FAMILY,
  } = require('./fieldTraining.completionLetter.template');
  const fontCss = loadFontFaceCss();
  const logoUri = assets.battechnoLogoDataUri || loadLogoDataUri() || '';
  const q = report.eligibility || {};
  const scoring = report.scoring || {};
  const breakdown = q.scoreBreakdown || {};
  const components = scoring.components || {};
  const attPts = breakdown.attendancePoints ?? components.attendance?.points;
  const postPts = breakdown.postAssessmentPoints ?? components.postAssessment?.points;
  const taskPts = breakdown.taskPoints ?? components.tasks?.points;
  const behPts = breakdown.behaviorPoints ?? components.behavior?.points;
  const finalScore = q.finalScore ?? q.approvedEvaluationResult?.approvedFinalScore;
  const passing = q.passingScore ?? scoring.passingScore ?? 80;
  const status =
    q.workflowOutcome ||
    report.application?.eligibilityStatus ||
    q.eligibilityStatus ||
    '';
  const approved = q.approvedEvaluationResult || {};
  const att = report.attendance || {};
  const tasks = report.tasks || {};
  const assessments = report.assessments || {};
  const pro = report.professionalEvaluation || {};
  const activity = report.activitySummary || {};
  const timeline = report.activityTimeline || [];
  const gates = q.mandatoryGates || [];
  const reasons = q.eligibilityReasonLabels || [];

  const taskRows = (tasks.items || []).map((task) => {
    const grade =
      task.approvedTaskScore != null
        ? `${task.approvedTaskScore}/100`
        : task.score != null
          ? `${task.score}${task.maxScore != null ? `/${task.maxScore}` : '/100'}`
          : '—';
    const review =
      task.accepted || task.reviewStatus === 'graded' || task.reviewStatus === 'approved'
        ? 'مكتمل'
        : task.submissionStatus === 'NOT_SUBMITTED' || task.submissionStatus === 'missing'
          ? 'غير مسلّم'
          : task.submissionStatusLabelAr || '—';
    return [
      task.title,
      task.submissionStatusLabelAr || (task.accepted ? 'مسلّم' : 'غير مسلّم'),
      review,
      grade,
      task.rawTaskScore != null ? `${task.rawTaskScore}` : '—',
      task.submittedAtLabelAr || '—',
      task.approvedSourceLabelAr || '—',
      task.isLate ? 'متأخر' : task.submittedAt ? 'في الوقت' : '—',
    ];
  });

  const sessionRows = (att.sessions || []).map((s) => [
    s.dateLabelAr || '—',
    s.title,
    s.statusLabelAr || s.status,
    s.durationHours != null ? `${s.durationHours}` : '—',
    s.isRequired === false ? 'اختيارية' : 'مطلوبة',
  ]);

  const criteriaRows = (pro.criteria || []).map((c) => [
    c.index,
    c.labelAr || c.key,
    c.score != null ? `${c.score}` : '—',
  ]);

  const timelineRows = timeline.slice(0, 60).map((ev) => [
    ev.occurredAtLabelAr || ev.createdAtLabelAr || '—',
    ev.categoryLabelAr || ev.category || '—',
    ev.titleAr || ev.actionType || '—',
    ev.detailAr || '—',
  ]);

  const coverLogo = logoUri
    ? `<img class="logo" src="${logoUri}" alt="BATMAN TECHNOLOGY" />`
    : `<div class="logo-fallback">BATMAN TECHNOLOGY</div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير الطالب الشامل — ${esc(report.student?.fullName || '')}</title>
  <style>
    ${fontCss}
    :root {
      --color-primary: #132d4a;
      --color-action: #1e5a8a;
      --color-accent: #c9a227;
      --color-cream: #f7f1e7;
      --color-text: #243241;
      --color-border: #d7dde5;
      --color-success: #2f6b4f;
      --color-warning: #b76e1f;
      --color-danger: #a33b3b;
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: '${FONT_FAMILY}', 'Traditional Arabic', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: var(--color-text);
      background: #fff;
      font-size: 13px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { color: var(--color-primary); font-weight: 700; }
    .cover {
      min-height: 980px;
      background: linear-gradient(160deg, #0e2136 0%, #132d4a 45%, #1e5a8a 100%);
      color: #fff;
      border-radius: 18px;
      padding: 40px 36px;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    .cover__ornament {
      position: absolute; inset: auto -40px -40px auto; width: 220px; height: 220px;
      border: 18px solid rgba(201,162,39,.25); border-radius: 50%;
    }
    .cover__brands { display:flex; justify-content: space-between; align-items: center; gap: 24px; }
    .logo { height: 64px; width: auto; object-fit: contain; background: rgba(255,255,255,.92); padding: 8px 12px; border-radius: 10px; }
    .logo-fallback { background: rgba(255,255,255,.92); color: var(--color-primary); padding: 12px 16px; border-radius: 10px; font-weight: 700; }
    .cover__title { text-align:center; font-size: 28px; margin: 56px 0 10px; font-weight: 700; }
    .cover__sub { text-align:center; font-size: 18px; color: #f3ead4; margin: 0 0 28px; }
    .cover__meta { max-width: 560px; margin: 0 auto; background: rgba(255,255,255,.08); padding: 18px 22px; border-radius: 14px; }
    .cover__meta p { margin: 6px 0; }
    .cover__footer { display:flex; justify-content: space-between; margin-top: 48px; font-size: 12px; opacity: .9; }
    .page-header { display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin: 0 0 16px; }
    .page-header img { height: 28px; background:#fff; padding: 2px 6px; border-radius: 6px; }
    .page-header__text { text-align: left; font-size: 11px; color: #5c6675; }
    .section { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 14px; page-break-inside: avoid; }
    .section h2 { margin: 0 0 12px; font-size: 16px; border-bottom: 2px solid #d4af37; padding-bottom: 4px; }
    .kpi-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
    .kpi { background: var(--color-cream); border-radius: 10px; padding: 10px; border: 1px solid var(--color-border); }
    .kpi__label { font-size: 11px; color: #5c6675; }
    .kpi__value { font-size: 15px; font-weight: 700; color: var(--color-primary); margin-top: 4px; }
    .score-hero { display:flex; justify-content: space-between; gap: 16px; align-items: stretch; margin-bottom: 12px; }
    .score-hero__main { flex: 1; background: linear-gradient(135deg, #132d4a, #1e5a8a); color:#fff; border-radius: 12px; padding: 16px 18px; }
    .score-hero__main span { display:block; opacity:.9; font-size: 12px; }
    .score-hero__main strong { display:block; font-size: 34px; margin-top: 4px; }
    .score-hero__side { width: 220px; background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 12px; padding: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 12px; }
    thead { display: table-header-group; }
    th, td { border: 1px solid var(--color-border); padding: 7px 8px; text-align: right; vertical-align: top; }
    th { background: var(--color-primary); color: #fff; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .muted { color: #5c6675; font-size: 12px; }
    .kv { display: grid; grid-template-columns: 190px 1fr; gap: 4px 12px; margin: 8px 0; }
    .kv div:nth-child(odd) { font-weight: 700; color: #3d4a5c; }
    .badge { display:inline-block; padding: 2px 10px; border-radius: 999px; background: #eef2f7; }
    .badge--ok { background: #e7f4ec; color: var(--color-success); }
    .badge--warn { background: #f8eedf; color: var(--color-warning); }
    .badge--bad { background: #f8e7e7; color: var(--color-danger); }
    .callout { background: #e7edf4; border-right: 4px solid var(--color-action); padding: 10px 12px; border-radius: 8px; margin: 8px 0; }
    .callout--warn { border-right-color: var(--color-warning); background: #f8eedf; }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .checklist li { display:flex; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding: 6px 0; }
    @page { size: A4; margin: 14mm 12mm 18mm; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover__ornament"></div>
    <div class="cover__brands">${coverLogo}<div class="logo-fallback">BATMAN TECHNOLOGY<br/>LMS</div></div>
    <h1 class="cover__title">تقرير الطالب الشامل<br/>للتدريب الميداني</h1>
    <p class="cover__sub">${esc(report.opportunity?.title || '')}</p>
    <div class="cover__meta">
      <p><strong>الطالب:</strong> ${dash(report.student?.fullName)}</p>
      <p><strong>الرقم الجامعي:</strong> ${dash(report.student?.universityNumber)}</p>
      <p><strong>الجامعة:</strong> ${dash(report.student?.university)}</p>
      <p><strong>التخصص:</strong> ${dash(report.student?.specialty)}</p>
      <p><strong>نمط التدريب:</strong> ${dash(report.opportunity?.trainingModeAr)}</p>
      <p><strong>الحالة النهائية:</strong> ${statusBadge(status)}</p>
      <p><strong>العلامة النهائية المعتمدة:</strong> ${finalScore != null ? esc(finalScore) + ' / 100' : '—'}</p>
    </div>
    <div class="cover__footer">
      <span>تاريخ الإصدار: ${dash(report.generatedAtLabelAr)}</span>
      <span>سري — للاستخدام الرسمي</span>
    </div>
  </div>

  <div class="page-header">
    <div>${logoUri ? `<img src="${logoUri}" alt="logo" />` : '<strong>BATMAN TECHNOLOGY</strong>'}</div>
    <div class="page-header__text">${dash(report.student?.fullName)} · ${dash(report.student?.universityNumber)}</div>
  </div>

  ${section(
    '1) البيانات الأساسية',
    kv([
      ['اسم الطالب', report.student?.fullName],
      ['الرقم الجامعي', report.student?.universityNumber],
      ['البريد الإلكتروني', report.student?.email],
      ['الهاتف', report.student?.phone],
      ['الجامعة', report.student?.university],
      ['التخصص', report.student?.specialty],
      ['المشرف الأكاديمي', report.application?.academicSupervisorName],
      ['حالة الطلب', report.application?.status],
      ['حالة التدريب', report.application?.trainingStatus],
    ]),
    'identity'
  )}

  ${section(
    '2) بيانات الفرصة والتدريب',
    kv([
      ['اسم الفرصة', report.opportunity?.title],
      ['جهة التدريب', report.opportunity?.organizationName],
      ['نمط التدريب', report.opportunity?.trainingModeAr],
      ['فترة التدريب', `${report.opportunity?.startDateLabelAr || '—'} — ${report.opportunity?.endDateLabelAr || '—'}`],
      ['الساعات المطلوبة', report.opportunity?.requiredTrainingHours],
      ['الحد الأدنى للحضور %', report.opportunity?.minimumAttendancePercentage],
      ['يتطلب مهمة نهائية', report.opportunity?.requiresFinalTask ? 'نعم' : 'لا'],
    ]),
    'opportunity'
  )}

  ${section(
    '3) النتيجة النهائية المعتمدة',
    `<div class="score-hero">
      <div class="score-hero__main">
        <span>العلامة النهائية المعتمدة</span>
        <strong>${finalScore != null ? esc(finalScore) + ' / 100' : '—'}</strong>
        <div style="margin-top:8px">${statusBadge(status)} · حد التأهيل: ${esc(passing)} / 100</div>
      </div>
      <div class="score-hero__side">
        <div class="muted">مصدر الاعتماد</div>
        <strong>${dash(approved.sourceLabelAr || approved.source || q.approvedSourceLabelAr)}</strong>
        <div class="muted" style="margin-top:10px">فرق العلامة عن الحد</div>
        <strong>${dash(q.scoreDifferenceLabelAr)}</strong>
      </div>
    </div>
    ${
      approved.changeReasonAr
        ? `<div class="callout">${esc(approved.changeReasonAr)}</div>`
        : ''
    }
    ${kv([
      ['العلامة السابقة في ملف التقييم', approved.previousExcelScore],
      ['العلامة المحسوبة آلياً', approved.recalculatedScore ?? q.recalculatedScore],
      ['تاريخ الاعتماد', approved.approvedAt],
    ])}`,
    'result'
  )}

  ${section(
    '4) تفصيل العلامة (20 / 20 / 40 / 20)',
    `<div class="kpi-grid">
      ${kpi('الحضور /20', attPts != null ? `${attPts} / 20` : '—')}
      ${kpi('التقييم البعدي /20', postPts != null ? `${postPts} / 20` : '—')}
      ${kpi('التاسكات /40', taskPts != null ? `${taskPts} / 40` : '—')}
      ${kpi('السلوك /20', behPts != null ? `${behPts} / 20` : '—')}
    </div>
    <p class="muted">المجموع = العلامة النهائية المعتمدة (${finalScore != null ? esc(finalScore) : '—'} / 100)، مع مراعاة التقريب المعروض فقط.</p>`,
    'breakdown'
  )}

  ${section(
    '5) متطلبات التأهيل',
    gates.length
      ? `<ul class="checklist">${gates
          .map(
            (g) =>
              `<li><span>${esc(g.nameAr || g.key)}</span><span>${esc(
                g.labelAr || (g.met ? 'مكتمل' : 'غير مكتمل')
              )}</span></li>`
          )
          .join('')}</ul>`
      : '<p class="muted">لا توجد بوابات إلزامية معروضة.</p>',
    'gates'
  )}

  ${section(
    '6) الحضور والساعات',
    `<div class="kpi-grid">
      ${kpi('نسبة الحضور', att.percentage != null ? `${att.percentage}%` : '—')}
      ${kpi('جلسات محتسبة', `${att.attended ?? 0} / ${att.requiredSessions ?? 0}`)}
      ${kpi('الساعات المنجزة', att.completedHours)}
      ${kpi('الساعات المطلوبة', att.requiredHours)}
      ${kpi('حاضر', att.counts?.present)}
      ${kpi('متأخر', att.counts?.late)}
      ${kpi('بعذر', att.counts?.excused)}
      ${kpi('غائب', att.counts?.absent)}
    </div>
    ${table(
      ['التاريخ', 'الجلسة', 'الحالة', 'المدة (ساعة)', 'النوع'],
      sessionRows,
      { empty: 'لا توجد جلسات حضور مسجّلة.' }
    )}`,
    'attendance'
  )}

  ${section(
    '7) التقييم القبلي والبعدي',
    `<div class="kpi-grid">
      ${kpi(
        'التقييم القبلي',
        assessments.pre?.completed
          ? `${assessments.pre.score ?? '—'} · ${assessments.pre.submittedAtLabelAr || ''}`
          : 'غير مكتمل'
      )}
      ${kpi(
        'التقييم البعدي',
        assessments.post?.completed
          ? `${assessments.post.score ?? '—'} · ${assessments.post.submittedAtLabelAr || ''}`
          : 'غير مكتمل'
      )}
      ${kpi('نقاط البعدي /20', postPts != null ? `${postPts} / 20` : '—')}
      ${kpi('حالة البعدي', assessments.post?.statusLabelAr || '—')}
    </div>`,
    'assessments'
  )}

  ${section(
    '8) التاسكات التفصيلية',
    `<div class="kpi-grid">
      ${kpi('التاسكات المكتملة تقييمًا', `${tasks.completedCount ?? 0} / ${tasks.requiredCount ?? 0}`)}
      ${kpi('التاسكات المسلّمة (LMS)', `${(tasks.items || []).filter((t) => t.submissionStatus !== 'NOT_SUBMITTED' && t.submissionStatus !== 'missing').length} / ${tasks.requiredCount ?? 0}`)}
      ${kpi('نقاط التاسكات /40', taskPts != null ? `${taskPts} / 40` : '—')}
      ${kpi('مصدر العدد', 'تسليمات نظام LMS')}
    </div>
    ${table(
      [
        'اسم المهمة',
        'حالة التسليم',
        'حالة التقييم',
        'العلامة المعتمدة',
        'العلامة المسجلة سابقاً',
        'تاريخ التسليم',
        'مصدر الاعتماد',
        'التوقيت',
      ],
      taskRows,
      { empty: 'لا توجد تاسكات مطلوبة.' }
    )}`,
    'tasks'
  )}

  ${section(
    '9) التقييم المهني / السلوك',
    `<div class="kpi-grid">
      ${kpi('المجموع المهني /50', pro.professionalTotal != null ? `${pro.professionalTotal} / ${pro.professionalMax || 50}` : '—')}
      ${kpi('نقاط السلوك /20', behPts != null ? `${behPts} / 20` : pro.behaviorPoints != null ? `${pro.behaviorPoints} / 20` : '—')}
      ${kpi('النسبة المهنية', pro.professionalPercentage != null ? `${pro.professionalPercentage}%` : '—')}
      ${kpi('تاريخ التقييم', pro.ratedAtLabelAr)}
    </div>
    ${table(['#', 'المعيار', 'الدرجة'], criteriaRows, { empty: 'لا توجد معايير سلوك مسجّلة.' })}`,
    'behavior'
  )}

  ${section(
    '10) أسباب القرار',
    reasons.length
      ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
      : String(status).toLowerCase() === 'eligible' || status === 'مؤهل'
        ? '<div class="callout">مؤهل وفق التقييم النهائي المعتمد.</div>'
        : '<p class="muted">لا توجد أسباب إضافية.</p>',
    'reasons'
  )}

  ${section(
    '11) نشاط الطالب على المنصة',
    `<div class="kpi-grid">
      ${kpi('تسجيلات الدخول الناجحة', activity.loginCount ?? activity.successfulLoginCount)}
      ${kpi('آخر تسجيل دخول', activity.lastLoginLabelAr || activity.lastLoginAtLabelAr)}
      ${kpi('أول نشاط مسجّل', activity.firstActivityLabelAr)}
      ${kpi('تسليمات التاسكات', activity.taskSubmissionsCount)}
      ${kpi('جلسات الحضور', `${activity.attendanceEventsCount ?? 0} / ${activity.requiredSessionsCount ?? 0}`)}
      ${kpi('التقييمات المكتملة', `${activity.assessmentsCompletedCount ?? 0} / ${activity.assessmentsRequiredCount ?? 0}`)}
    </div>
    ${
      !(activity.loginCount || activity.successfulLoginCount)
        ? '<div class="callout callout--warn">بيانات تسجيل الدخول التاريخية غير متاحة بالكامل لبعض الفترات.</div>'
        : ''
    }
    ${table(
      ['الوقت', 'التصنيف', 'الحدث', 'التفاصيل'],
      timelineRows,
      { empty: 'لا يوجد نشاط مسجّل بعد.' }
    )}`,
    'activity'
  )}

  ${section(
    '12) بيانات الإصدار',
    kv([
      ['تاريخ إنشاء التقرير', report.generatedAtLabelAr],
      ['الشركة', 'BATMAN TECHNOLOGY'],
      ['نوع التقرير', 'تقرير الطالب الشامل — التدريب الميداني'],
      ['معرّف الطلب', report.application?.id],
      ['معرّف الفرصة', report.opportunity?.id],
    ]),
    'meta'
  )}
</body>
</html>`;
}

async function exportComprehensiveStudentReportPdf(opportunityId, applicationId, user, query = {}) {
  const report = await getComprehensiveStudentReport(opportunityId, applicationId, user, query);
  const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
  const { loadBattechnoLogoDataUri } = require('../trainingPrograms/trainingReportPdf.service');
  const html = renderComprehensiveReportHtml(report, {
    battechnoLogoDataUri: loadBattechnoLogoDataUri(),
  });
  const buffer = await renderHtmlToPdf(html, {
    lang: 'ar',
    footerLeft: 'BATMAN TECHNOLOGY · تقرير الطالب الشامل',
    footerNote: report.generatedAtLabelAr || '',
  });
  const uni = String(report.student?.universityNumber || applicationId.slice(0, 8)).replace(
    /[^\w-]/g,
    ''
  );
  const nameSlug = String(report.student?.fullName || 'student')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `${uni}_${nameSlug || 'student'}_Field_Training_Report.pdf`,
    report,
  };
}

module.exports = {
  getComprehensiveStudentReport,
  exportComprehensiveStudentReportPdf,
  renderComprehensiveReportHtml,
  ATTENDANCE_STATUS_AR,
  REVIEW_STATUS_AR,
};
