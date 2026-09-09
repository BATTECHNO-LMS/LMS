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
const present = require('../../utils/fieldTraining.reportPresentation');

const ATTENDANCE_STATUS_AR = Object.freeze({
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'بعذر',
  unconfirmed: 'غير محدد',
});

const REVIEW_STATUS_AR = Object.freeze({
  approved: 'تم التقييم',
  graded: 'تم التقييم',
  submitted: 'مسلّم',
  under_review: 'قيد المراجعة',
  pending: 'لم يتم التقييم',
  needs_revision: 'تحتاج إعادة تسليم',
  rejected: 'تحتاج إعادة تسليم',
  not_submitted: 'غير مسلّم',
  missing: 'غير مسلّم',
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
  // University-facing reports prefer date-only; keep helper for internal activity timestamps.
  return present.formatDateAr(value);
}

function formatDateAr(value) {
  return present.formatDateAr(value);
}

function gateLabel(ok) {
  if (ok === true) return { status: 'passed', labelAr: 'مستوفى' };
  if (ok === false) return { status: 'failed', labelAr: 'غير مستوفى' };
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
          ? `تجاوز حد التأهيل بمقدار ${diff} علامة`
          : `${Math.abs(diff)} علامة`,
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
        nameAr: 'الحضور',
        ...gateLabel(gates.attendanceRequirementMet),
      },
      {
        key: 'hours',
        nameAr: 'الساعات التدريبية',
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
        nameAr: 'تقييم السلوك والالتزام',
        ...completeLabel(gates.behaviorEvaluationComplete),
      },
      {
        key: 'finalScore',
        nameAr: 'الحد الأدنى للعلامة النهائية',
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
      gates.behaviorEvaluationComplete ? 'استكمل تقييم السلوك والالتزام' : null,
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
        : 'غير متوفر بالكامل',
      firstLoginAt: firstLoginAudit?.created_at || null,
      firstLoginAtLabelAr: formatDateAr(firstLoginAudit?.created_at),
      lastLoginAt: student?.last_login_at || null,
      lastLoginAtLabelAr: formatDateAr(student?.last_login_at),
      firstActivityAt: timeline.length
        ? timeline[timeline.length - 1]?.at
        : student?.created_at || null,
      firstActivityAtLabelAr: formatDateAr(
        timeline.length ? timeline[timeline.length - 1]?.at : student?.created_at
      ),
      trackingEnabled: trackingExists,
      loginNoteAr: trackingExists
        ? null
        : 'ملاحظة: لا تتوفر بيانات كاملة لعدد مرات تسجيل الدخول خلال كامل فترة التدريب.',
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
      title: present.cleanSessionTitle(session.title),
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
        ? 'مسلّم'
        : 'غير مسلّم',
      reviewStatusLabelAr: isGraded
        ? 'تم التقييم'
        : submitted
          ? REVIEW_STATUS_AR[reviewStatus] || 'لم يتم التقييم'
          : 'لم يتم التقييم',
      submittedAt: sub?.submitted_at || null,
      submittedAtLabelAr: formatDateAr(sub?.submitted_at),
      isLate: Boolean(sub?.is_late),
      score: canonicalScore,
      rawTaskScore:
        approvedDetail?.rawTaskScore != null
          ? Number(approvedDetail.rawTaskScore)
          : canonicalScore,
      approvedTaskScore,
      approvedSourceLabelAr: submitted
        ? present.labelSourceHuman(
            approvedDetail?.source || (isGraded ? 'AUTHORIZED_MANUAL_REVIEW' : null)
          )
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
    generatedAtLabelAr: formatDateAr(new Date()),
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
            : opp.training_mode === 'hybrid'
              ? 'مدمج'
              : present.displayValue(opp.training_mode, 'غير محدد'),
      startDate: opp.start_date,
      endDate: opp.end_date,
      startDateLabelAr: formatDateAr(opp.start_date),
      endDateLabelAr: formatDateAr(opp.end_date),
      periodLabelAr: present.formatDateRangeAr(opp.start_date, opp.end_date),
      academicYear: null,
      semester: null,
      requiredTrainingHours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
      minimumAttendancePercentage:
        opp.minimum_attendance_percentage != null
          ? Number(opp.minimum_attendance_percentage)
          : null,
      requiresFinalTask: Boolean(opp.requires_final_task),
      requiresFinalTaskLabelAr: opp.requires_final_task ? 'مطلوبة' : 'غير مطلوبة',
    },
    application: {
      id: app.id,
      status: app.status,
      statusLabelAr: present.labelApplicationStatus(app.status),
      trainingStatus: app.training_status,
      trainingStatusLabelAr: present.labelTrainingStatus(app.training_status),
      eligibilityStatus: app.completion_eligibility_status,
      eligibilityStatusLabelAr: present.labelEligibilityStatus(app.completion_eligibility_status),
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
      submittedCount: taskRows.filter(
        (t) => t.submissionStatus !== 'NOT_SUBMITTED' && t.submissionStatus !== 'missing'
      ).length,
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
      ratedAtLabelAr: formatDateAr(ratings[0]?.rated_at),
    },
    activitySummary: {
      ...activity.summary,
      taskSubmissionsCount: taskRows.filter(
        (t) => t.submissionStatus !== 'NOT_SUBMITTED' && t.submissionStatus !== 'missing'
      ).length,
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
  return present.esc(value);
}

function cell(value, fallback = 'غير متوفر') {
  if (value != null && String(value).includes('<span dir="ltr">')) return String(value);
  return esc(present.displayValue(value, fallback));
}

function kpi(label, value) {
  const rendered =
    value != null && String(value).includes('<span dir="ltr">')
      ? String(value)
      : cell(value);
  return `<div class="kpi"><div class="kpi__label">${esc(label)}</div><div class="kpi__value">${rendered}</div></div>`;
}

function section(title, body, id = '') {
  return `<section class="section"${id ? ` id="${esc(id)}"` : ''}><h2>${esc(title)}</h2>${body}</section>`;
}

function kv(pairs) {
  return `<div class="kv">${pairs
    .map(([k, v, fallback]) => `<div>${esc(k)}</div><div>${cell(v, fallback || 'غير متوفر')}</div>`)
    .join('')}</div>`;
}

function table(headers, rows, { empty = 'لا توجد بيانات.' } = {}) {
  if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr>${r
            .map((c) => {
              if (c != null && String(c).includes('<span dir="ltr">')) return `<td>${c}</td>`;
              return `<td>${cell(c, 'لا يوجد')}</td>`;
            })
            .join('')}</tr>`
      )
      .join('')}</tbody>
  </table>`;
}

function statusBadge(status) {
  const label = present.labelEligibilityStatus(status);
  const ok = present.isEligibleStatus(status) || label === 'مؤهل';
  const bad = present.isNotEligibleStatus(status) || label === 'غير مؤهل';
  const cls = ok ? 'badge badge--ok' : bad ? 'badge badge--bad' : 'badge badge--warn';
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
  const att = report.attendance || {};
  const tasks = report.tasks || {};
  const assessments = report.assessments || {};
  const pro = report.professionalEvaluation || {};
  const activity = report.activitySummary || {};
  const timeline = report.activityTimeline || [];
  const gates = q.mandatoryGates || [];
  const notEligible = present.isNotEligibleStatus(status);
  const eligible = present.isEligibleStatus(status);
  const decisionReasons = notEligible ? present.buildNotEligibleReasonsAr(report) : [];
  const issueDate = report.generatedAtLabelAr || present.formatDateAr(new Date());
  const submittedCount =
    tasks.submittedCount ??
    (tasks.items || []).filter(
      (t) => t.submissionStatus !== 'NOT_SUBMITTED' && t.submissionStatus !== 'missing'
    ).length;
  const gradedCount = (tasks.items || []).filter((t) => t.accepted).length;

  const taskRows = (tasks.items || []).map((task) => {
    const hasGrade = task.approvedTaskScore != null || task.score != null;
    const grade = hasGrade
      ? present.scoreHtml(task.approvedTaskScore ?? task.score, task.maxScore ?? 100, 'لا توجد')
      : esc('لا توجد');
    return [
      task.title,
      task.submissionStatusLabelAr || (task.accepted ? 'مسلّم' : 'غير مسلّم'),
      task.reviewStatusLabelAr ||
        (task.accepted ? 'تم التقييم' : hasGrade ? 'تم التقييم' : 'لم يتم التقييم'),
      grade,
      task.submittedAtLabelAr || 'لا يوجد',
    ];
  });

  const sessionRows = (att.sessions || []).map((s) => [
    s.dateLabelAr || 'غير متوفر',
    present.cleanSessionTitle(s.title),
    s.statusLabelAr || present.displayValue(s.status, 'غير محدد'),
    s.durationHours != null ? present.scoreHtml(s.durationHours, null, 'غير متوفر') : 'غير متوفر',
    s.isRequired === false ? 'اختيارية' : 'مطلوبة',
  ]);

  const criteriaRows = (pro.criteria || []).map((c) => [
    c.labelAr || c.key,
    c.score != null ? present.scoreHtml(c.score, c.maxScore || 5, 'غير مكتمل') : 'غير مكتمل',
  ]);

  const usefulTimeline = timeline.filter((ev) => {
    const title = ev.title || ev.titleAr || '';
    const description = ev.description || ev.detailAr || '';
    return Boolean(String(title).trim() || String(description).trim());
  });

  const timelineRows = usefulTimeline.slice(0, 60).map((ev) => [
    ev.atLabelAr || ev.occurredAtLabelAr || present.formatDateAr(ev.at) || 'غير متوفر',
    ev.categoryLabelAr || 'نشاط',
    present.sanitizeVisibleText(ev.title || ev.titleAr, 'حدث'),
    present.sanitizeVisibleText(ev.description || ev.detailAr, 'لا يوجد'),
  ]);

  const coverLogo = logoUri
    ? `<img class="logo" src="${logoUri}" alt="BATMAN TECHNOLOGY" />`
    : `<div class="logo-fallback">BATMAN TECHNOLOGY</div>`;

  const scoreDiffLabel =
    finalScore == null
      ? 'غير متوفر'
      : Number(finalScore) >= Number(passing)
        ? `تجاوز حد التأهيل بمقدار ${Math.abs(Number(finalScore) - Number(passing))} علامة`
        : `${Math.abs(Number(finalScore) - Number(passing))} علامة`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير الطالب الشامل - ${esc(report.student?.fullName || '')}</title>
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
      line-height: 1.75;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { color: var(--color-primary); font-weight: 700; }
    .cover {
      min-height: 980px;
      background: linear-gradient(160deg, #0e2136 0%, #132d4a 45%, #1e5a8a 100%);
      color: #fff;
      border-radius: 18px;
      padding: 44px 38px;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    .cover__ornament {
      position: absolute; inset: auto -40px -40px auto; width: 220px; height: 220px;
      border: 18px solid rgba(201,162,39,.25); border-radius: 50%;
    }
    .cover__brands { display:flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 8px; }
    .logo { height: 64px; width: auto; object-fit: contain; background: rgba(255,255,255,.92); padding: 8px 12px; border-radius: 10px; }
    .logo-fallback { background: rgba(255,255,255,.92); color: var(--color-primary); padding: 12px 16px; border-radius: 10px; font-weight: 700; }
    .cover__title {
      text-align:center;
      font-size: 30px;
      margin: 52px 0 8px;
      font-weight: 700;
      color: #ffffff !important;
      letter-spacing: 0.2px;
      line-height: 1.45;
    }
    .cover__title span { display:block; color: #ffffff !important; }
    .cover__sub {
      text-align:center;
      font-size: 15px;
      color: #ffffff;
      opacity: 0.92;
      margin: 18px auto 30px;
      max-width: 620px;
      line-height: 1.6;
      font-weight: 500;
    }
    .cover__meta {
      max-width: 560px;
      margin: 0 auto;
      background: rgba(255,255,255,.10);
      padding: 20px 24px;
      border-radius: 14px;
      border: 1px solid rgba(201,162,39,.35);
    }
    .cover__meta p { margin: 7px 0; color: #ffffff; }
    .cover__meta strong { color: #f7f1e7; }
    .cover__footer { display:flex; justify-content: space-between; margin-top: 52px; font-size: 12px; color: #ffffff; opacity: .92; }
    .page-header { display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin: 0 0 16px; }
    .page-header img { height: 28px; background:#fff; padding: 2px 6px; border-radius: 6px; }
    .page-header__text { text-align: left; font-size: 11px; color: #5c6675; }
    .section { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 14px; page-break-inside: avoid; }
    .section h2 { margin: 0 0 14px; font-size: 16px; border-bottom: 2px solid #c9a227; padding-bottom: 6px; }
    .kpi-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
    .kpi { background: var(--color-cream); border-radius: 10px; padding: 12px; border: 1px solid var(--color-border); }
    .kpi__label { font-size: 11px; color: #5c6675; }
    .kpi__value { font-size: 15px; font-weight: 700; color: var(--color-primary); margin-top: 6px; }
    .score-hero { display:flex; justify-content: space-between; gap: 16px; align-items: stretch; margin-bottom: 12px; }
    .score-hero__main { flex: 1; background: linear-gradient(135deg, #132d4a, #1e5a8a); color:#fff; border-radius: 12px; padding: 18px 20px; }
    .score-hero__main span { display:block; opacity:.92; font-size: 12px; color:#fff; }
    .score-hero__main strong { display:block; font-size: 36px; margin-top: 6px; color:#fff; letter-spacing: 0.3px; }
    .score-hero__side { width: 230px; background: var(--color-cream); border: 1px solid var(--color-border); border-radius: 12px; padding: 14px 16px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 12px; }
    thead { display: table-header-group; }
    th, td { border: 1px solid var(--color-border); padding: 8px 9px; text-align: right; vertical-align: top; }
    th { background: var(--color-primary); color: #fff; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .muted { color: #5c6675; font-size: 12px; }
    .kv { display: grid; grid-template-columns: 200px 1fr; gap: 6px 14px; margin: 8px 0; }
    .kv div:nth-child(odd) { font-weight: 700; color: #3d4a5c; }
    .badge { display:inline-block; padding: 3px 12px; border-radius: 999px; background: #eef2f7; }
    .badge--ok { background: #e7f4ec; color: var(--color-success); }
    .badge--warn { background: #f8eedf; color: var(--color-warning); }
    .badge--bad { background: #f8e7e7; color: var(--color-danger); }
    .callout { background: #e7edf4; border-right: 4px solid var(--color-action); padding: 10px 12px; border-radius: 8px; margin: 8px 0; }
    .callout--warn { border-right-color: var(--color-warning); background: #f8eedf; }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .checklist li { display:flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--color-border); padding: 7px 0; }
    .reasons { margin: 0; padding-right: 18px; }
    .reasons li { margin: 6px 0; }
    @page { size: A4; margin: 14mm 12mm 18mm; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover__ornament"></div>
    <div class="cover__brands">${coverLogo}<div class="logo-fallback">BATMAN TECHNOLOGY<br/>LMS</div></div>
    <h1 class="cover__title"><span>تقرير الطالب الشامل</span><span>للتدريب الميداني</span></h1>
    <p class="cover__sub">${esc(report.opportunity?.title || '')}</p>
    <div class="cover__meta">
      <p><strong>الطالب:</strong> ${cell(report.student?.fullName, 'غير محدد')}</p>
      <p><strong>الرقم الجامعي:</strong> ${cell(report.student?.universityNumber, 'غير متوفر')}</p>
      <p><strong>الجامعة:</strong> ${cell(report.student?.university, 'غير محدد')}</p>
      <p><strong>التخصص:</strong> ${cell(report.student?.specialty, 'غير محدد')}</p>
      <p><strong>نمط التدريب:</strong> ${cell(report.opportunity?.trainingModeAr, 'غير محدد')}</p>
      <p><strong>الحالة النهائية:</strong> ${statusBadge(status)}</p>
      <p><strong>العلامة النهائية:</strong> ${finalScore != null ? present.scoreHtml(finalScore, 100) : esc('غير متوفر')}</p>
    </div>
    <div class="cover__footer">
      <span>تاريخ الإصدار: ${esc(issueDate || 'غير متوفر')}</span>
      <span>سري - للاستخدام الرسمي</span>
    </div>
  </div>

  <div class="page-header">
    <div>${logoUri ? `<img src="${logoUri}" alt="logo" />` : '<strong>BATMAN TECHNOLOGY</strong>'}</div>
    <div class="page-header__text">${cell(report.student?.fullName, '')} · ${cell(report.student?.universityNumber, '')}</div>
  </div>

  ${section(
    '1. البيانات الأساسية',
    kv([
      ['اسم الطالب', report.student?.fullName, 'غير محدد'],
      ['الرقم الجامعي', report.student?.universityNumber],
      ['البريد الإلكتروني', report.student?.email],
      ['الهاتف', report.student?.phone],
      ['الجامعة', report.student?.university, 'غير محدد'],
      ['التخصص', report.student?.specialty, 'غير محدد'],
      ['المشرف الأكاديمي', report.application?.academicSupervisorName, 'غير محدد'],
      ['حالة الطلب', report.application?.statusLabelAr || present.labelApplicationStatus(report.application?.status)],
      ['حالة التدريب', report.application?.trainingStatusLabelAr || present.labelTrainingStatus(report.application?.trainingStatus)],
    ]),
    'identity'
  )}

  ${section(
    '2. بيانات التدريب',
    kv([
      ['اسم البرنامج', report.opportunity?.title],
      ['جهة التدريب', report.opportunity?.organizationName, 'غير محدد'],
      ['نمط التدريب', report.opportunity?.trainingModeAr, 'غير محدد'],
      ['فترة التدريب', report.opportunity?.periodLabelAr || present.formatDateRangeAr(report.opportunity?.startDateLabelAr, report.opportunity?.endDateLabelAr), 'غير محدد'],
      ['الساعات التدريبية المطلوبة', report.opportunity?.requiredTrainingHours],
      ['الحد الأدنى للحضور', report.opportunity?.minimumAttendancePercentage != null ? `${report.opportunity.minimumAttendancePercentage}%` : null],
      ['المهمة النهائية', report.opportunity?.requiresFinalTaskLabelAr || (report.opportunity?.requiresFinalTask ? 'مطلوبة' : 'غير مطلوبة')],
    ]),
    'opportunity'
  )}

  ${section(
    '3. النتيجة النهائية',
    `<div class="score-hero">
      <div class="score-hero__main">
        <span>العلامة النهائية</span>
        <strong>${finalScore != null ? `<span dir="ltr">${esc(finalScore)} / 100</span>` : esc('غير متوفر')}</strong>
        <div style="margin-top:10px">${statusBadge(status)}</div>
      </div>
      <div class="score-hero__side">
        <div class="muted">الحالة</div>
        <strong>${esc(present.labelEligibilityStatus(status))}</strong>
        <div class="muted" style="margin-top:10px">الحد الأدنى للتأهيل</div>
        <strong>${present.scoreHtml(passing, 100)}</strong>
        <div class="muted" style="margin-top:10px">الفرق عن حد التأهيل</div>
        <strong>${esc(scoreDiffLabel)}</strong>
      </div>
    </div>`,
    'result'
  )}

  ${section(
    '4. توزيع العلامة',
    `<div class="kpi-grid">
      ${kpi('الحضور', present.scoreHtml(attPts, 20))}
      ${kpi('التقييم البعدي', present.scoreHtml(postPts, 20))}
      ${kpi('التاسكات', present.scoreHtml(taskPts, 40))}
      ${kpi('السلوك والالتزام', present.scoreHtml(behPts, 20))}
    </div>
    <div class="callout" style="margin-top:12px"><strong>المجموع النهائي:</strong> ${finalScore != null ? present.scoreHtml(finalScore, 100) : esc('غير متوفر')}</div>`,
    'breakdown'
  )}

  ${section(
    '5. استيفاء متطلبات التدريب',
    gates.length
      ? `<ul class="checklist">${gates
          .map(
            (g) =>
              `<li><span>${esc(g.nameAr || g.key)}</span><span>${esc(
                g.labelAr || 'غير متوفر'
              )}</span></li>`
          )
          .join('')}</ul>
         <div class="callout" style="margin-top:10px"><strong>النتيجة النهائية:</strong> ${esc(present.labelEligibilityStatus(status))}</div>`
      : '<p class="muted">لا توجد متطلبات معروضة.</p>',
    'gates'
  )}

  ${section(
    '6. الحضور والساعات التدريبية',
    `<div class="kpi-grid">
      ${kpi('نسبة الحضور', att.percentage != null ? `${att.percentage}%` : 'غير متوفر')}
      ${kpi('الجلسات المحتسبة', present.countOfHtml(att.attended ?? 0, att.requiredSessions ?? 0))}
      ${kpi('الساعات المنجزة', att.completedHours)}
      ${kpi('الساعات المطلوبة', att.requiredHours)}
      ${kpi('حاضر', att.counts?.present ?? 0)}
      ${kpi('متأخر', att.counts?.late ?? 0)}
      ${kpi('بعذر', att.counts?.excused ?? 0)}
      ${kpi('غائب', att.counts?.absent ?? 0)}
    </div>
    ${table(
      ['التاريخ', 'الجلسة', 'الحالة', 'المدة (ساعة)', 'النوع'],
      sessionRows,
      { empty: 'لا توجد جلسات حضور مسجّلة.' }
    )}`,
    'attendance'
  )}

  ${section(
    '7. التقييم القبلي والبعدي',
    `<div class="kv">
        <div>التقييم القبلي</div><div>${assessments.pre?.score != null ? present.scoreHtml(assessments.pre.score, assessments.pre.maxScore || 100) : esc(assessments.pre?.completed ? 'مكتمل' : 'غير مكتمل')}</div>
        <div>تاريخ الإجراء</div><div>${cell(assessments.pre?.submittedAtLabelAr, 'غير متوفر')}</div>
        <div>التقييم البعدي</div><div>${assessments.post?.score != null ? present.scoreHtml(assessments.post.score, assessments.post.maxScore || 100) : esc(assessments.post?.completed ? 'مكتمل' : 'غير مكتمل')}</div>
        <div>تاريخ الإجراء</div><div>${cell(assessments.post?.submittedAtLabelAr, 'غير متوفر')}</div>
        <div>العلامة المحتسبة من التقييم البعدي</div><div>${present.scoreHtml(postPts, 20)}</div>
        <div>الحالة</div><div>${cell(assessments.post?.statusLabelAr || (assessments.post?.completed ? 'مكتمل' : 'غير مكتمل'))}</div>
      </div>`,
    'assessments'
  )}

  ${section(
    '8. التاسكات',
    `<div class="kpi-grid">
      ${kpi('التاسكات المسلمة', present.countOfHtml(submittedCount, tasks.requiredCount ?? 0))}
      ${kpi('التاسكات التي تم تقييمها', present.countOfHtml(gradedCount, tasks.requiredCount ?? 0))}
      ${kpi('علامة التاسكات', present.scoreHtml(taskPts, 40))}
    </div>
    ${table(
      ['اسم التاسك', 'حالة التسليم', 'حالة التقييم', 'العلامة', 'تاريخ التسليم'],
      taskRows,
      { empty: 'لا توجد تاسكات مطلوبة.' }
    )}`,
    'tasks'
  )}

  ${section(
    '9. تقييم السلوك والالتزام',
    `<div class="kpi-grid">
      ${kpi('العلامة المحتسبة', present.scoreHtml(behPts ?? pro.behaviorPoints, 20))}
    </div>
    ${table(['المعيار', 'التقييم'], criteriaRows, { empty: 'لا توجد معايير سلوك مسجّلة.' })}`,
    'behavior'
  )}

  ${
    notEligible
      ? section(
          '10. أسباب عدم التأهيل',
          `<ol class="reasons">${decisionReasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>`,
          'reasons'
        )
      : eligible
        ? section(
            '10. نتيجة التأهيل',
            `<div class="callout">استوفى الطالب متطلبات التدريب المعتمدة.<br/><strong>النتيجة النهائية:</strong> مؤهل</div>`,
            'reasons'
          )
        : ''
  }

  ${section(
    '11. نشاط الطالب على المنصة',
    `<div class="kpi-grid">
      ${kpi('آخر دخول إلى المنصة', activity.lastLoginAtLabelAr || activity.lastLoginLabelAr || 'غير متوفر')}
      ${kpi('جلسات الحضور المسجلة', present.countOfHtml(activity.attendanceEventsCount ?? 0, activity.requiredSessionsCount ?? 0))}
      ${kpi('التاسكات المسلمة', present.countOfHtml(activity.taskSubmissionsCount ?? submittedCount, activity.requiredTasksCount ?? tasks.requiredCount ?? 0))}
      ${kpi('التقييمات المكتملة', present.countOfHtml(activity.assessmentsCompletedCount ?? 0, activity.assessmentsRequiredCount ?? 0))}
    </div>
    ${
      activity.loginNoteAr || !(activity.loginCountAvailable || activity.loginCount)
        ? `<div class="callout callout--warn">${esc(
            activity.loginNoteAr ||
              'ملاحظة: لا تتوفر بيانات كاملة لعدد مرات تسجيل الدخول خلال كامل فترة التدريب.'
          )}</div>`
        : ''
    }
    ${
      timelineRows.length
        ? table(['التاريخ', 'التصنيف', 'الحدث', 'التفاصيل'], timelineRows, {
            empty: 'لا يوجد نشاط مسجّل بعد.',
          })
        : ''
    }`,
    'activity'
  )}

  ${section(
    '12. بيانات التقرير',
    kv([
      ['تاريخ إصدار التقرير', issueDate],
      ['جهة الإصدار', 'شركة الرجل الوطواط للتكنولوجيا'],
      ['نوع التقرير', 'التقرير الشامل للتدريب الميداني'],
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
    footerLeft: 'BATMAN TECHNOLOGY | تقرير الطالب الشامل',
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
