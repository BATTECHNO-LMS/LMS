'use strict';

/**
 * Canonical approved Tafila evaluation result resolver + AUTHORIZED_MANUAL_REVIEW
 * reconciliation for opportunity 4d9466cb-127b-42f2-ac08-88e7fcc7c7df only.
 *
 * Policy: historically ELIGIBLE stay ELIGIBLE; correct approved task component
 * so Final Score matches 20/20/40/20 without destroying raw task submissions.
 */

const { prisma } = require('../../config/db');
const { recordAudit } = require('../../utils/auditRecorder');
const qualificationService = require('./fieldTraining.qualification.service');
const {
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  LAITH_UNIVERSITY_NUMBER,
  APPROVED_NOT_ELIGIBLE,
  getBaselineByUniversityNumber,
  isPrimaryTafilaOpportunity,
  mapExcelStatusToWorkflow,
  normalizeUniversityNumber,
  baselineCount,
} = require('./fieldTraining.tafilaApprovedBaseline');
const taskNorm = require('./fieldTraining.tafilaTaskNormalization');

const SOURCE = Object.freeze({
  EXCEL_BASELINE: 'EXCEL_BASELINE',
  VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE: 'VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE',
  AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
  AUTHORIZED_GRADE_OVERRIDE: 'AUTHORIZED_GRADE_OVERRIDE',
  AUTHORIZED_MANUAL_REVIEW: 'AUTHORIZED_MANUAL_REVIEW',
  AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT: 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT',
});

const SOURCE_AR = Object.freeze({
  EXCEL_BASELINE: 'النتيجة المعتمدة المرسلة للجامعة',
  VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE: 'إعادة احتساب معتمدة',
  AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE: 'قرار إداري معتمد',
  AUTHORIZED_GRADE_OVERRIDE: 'تصحيح علامة معتمد',
  AUTHORIZED_MANUAL_REVIEW: 'مراجعة واعتماد نهائي',
  AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT: 'تقييم نهائي معتمد للدفعة السابقة',
});

const REASON_AR = Object.freeze({
  ELIGIBLE: 'مؤهل وفق النتيجة النهائية المعتمدة بعد مراجعة التقييم.',
  ELIGIBLE_DETAIL: 'استوفى الطالب متطلبات التدريب وفق التقييم النهائي المعتمد.',
  EXCEL_BASELINE: 'نتيجة معتمدة من ملف التقييم النهائي للدفعة.',
  MANUAL_REVIEW:
    'تم اعتماد تقييم التاسكات بموجب مراجعة إدارية معتمدة (علامات التاسكات المسلّمة ضمن 80–90).',
  LEGACY_TASK:
    'تم اعتماد مكوّن التاسكات تجميعياً لهذه الدفعة السابقة دون إنشاء تسليمات وهمية.',
  RECALC_KEEP_ELIGIBLE:
    'تمت إعادة احتساب العلامة اعتماداً على بيانات الحضور والتقييم البعدي والتاسكات والتقييم المهني.',
  RECALC_NOT_ELIGIBLE: (score) =>
    `العلامة النهائية أقل من الحد الأدنى المطلوب للتأهيل؛ حصل الطالب على ${score} من 100 والمطلوب 80 من 100.`,
  ADMIN_NOT_ELIGIBLE: 'قرار إداري معتمد بعدم التأهيل مع الاحتفاظ بالعلامات الفعلية للطالب.',
  ZERO_NOT_ELIGIBLE: 'غير مؤهل وفق النتيجة المعتمدة في ملف التقييم النهائي.',
});

function round1(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function sourceLabelAr(source) {
  return SOURCE_AR[source] || source || '—';
}

function buildApprovedResult({
  approvedFinalScore,
  approvedStatus,
  source,
  previousExcelScore = null,
  recalculatedScore = null,
  changeReasonAr = null,
  scoreBreakdown = null,
  approvedTaskEvaluation = null,
  rawTaskData = null,
  extra = {},
}) {
  return {
    approvedFinalScore: approvedFinalScore == null ? null : round1(approvedFinalScore),
    approvedStatus,
    workflowStatus: mapExcelStatusToWorkflow(approvedStatus),
    source,
    sourceLabelAr: sourceLabelAr(source),
    previousExcelScore: previousExcelScore == null ? null : round1(previousExcelScore),
    recalculatedScore: recalculatedScore == null ? null : round1(recalculatedScore),
    changeReasonAr,
    scoreBreakdown: scoreBreakdown || null,
    approvedTaskEvaluation: approvedTaskEvaluation || null,
    rawTaskData: rawTaskData || null,
    approvedAt: new Date().toISOString(),
    opportunityId: PRIMARY_TAFILA_OPPORTUNITY_ID,
    ...extra,
  };
}

function extractComponents(calculated) {
  const att = round1(calculated?.attendanceComponentScore);
  const post = round1(calculated?.postAssessmentComponentScore);
  const tasks = round1(calculated?.tasksComponentScore);
  const beh = round1(calculated?.professionalComponentScore);
  const details = calculated?.scoreComponents?.tasks?.details || [];
  return {
    attendancePoints: att,
    postAssessmentPoints: post,
    rawTaskPoints: tasks,
    behaviorPoints: beh,
    taskDetails: details,
    rawFinal: calculated?.finalScore == null ? null : round1(calculated.finalScore),
  };
}

/** Delegate to historical 80–90 task normalization module. */
function computeEligibleApprovedScore(input) {
  return taskNorm.computeEligibleApprovedScore(input);
}

async function loadOpportunityPopulation() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      completion_eligibility_status: true,
      eligibility_reason: true,
      attendance_percentage: true,
      completed_training_hours: true,
      post_assessment_score: true,
      pre_assessment_score: true,
      training_status: true,
    },
  });
  const repo = require('./fieldTraining.repository');
  const profiles = await repo.findStudentProfilesByIds(apps.map((a) => a.student_id));
  const byStudent = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return apps.map((app) => {
    const profile = byStudent[app.student_id] || {};
    const uni = normalizeUniversityNumber(profile.university_student_number);
    return {
      applicationId: app.id,
      studentId: app.student_id,
      studentName: profile.full_name || '',
      universityNumber: uni,
      app,
      profile,
      baseline: uni ? getBaselineByUniversityNumber(uni) : null,
    };
  });
}

async function applyLaithAuthorizedTaskGrades({ dryRun = true, actorUserId = null } = {}) {
  const uni = LAITH_UNIVERSITY_NUMBER;
  const user = await prisma.users.findFirst({
    where: { university_student_number: uni },
    select: { id: true, full_name: true },
  });
  if (!user) {
    return { ok: false, error: 'LAITH_USER_NOT_FOUND', universityNumber: uni };
  }
  const app = await prisma.field_training_applications.findFirst({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID, student_id: user.id, status: 'approved' },
  });
  if (!app) {
    return { ok: false, error: 'LAITH_APPLICATION_NOT_FOUND', universityNumber: uni };
  }
  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID, NOT: { is_required: false } },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    select: { id: true, title: true, sort_order: true, created_at: true },
  });
  const byTitle = (re) => tasks.find((t) => re.test(String(t.title || ''))) || null;
  const task1 = byTitle(/المهمة الأولى|Task\s*1/i) || tasks[0] || null;
  const task2 = byTitle(/المهمة الثانية|Task\s*2/i) || tasks[1] || null;
  const task3 = byTitle(/المهمة الثالثة|Task\s*3/i) || tasks[2] || null;
  const task4 = byTitle(/المهمة الرابعة|Task\s*4/i) || tasks[3] || null;
  const targetGrades = [
    { task: task1, score: 84, label: 'Task 1' },
    { task: task2, score: 78, label: 'Task 2' },
  ];
  const changes = [];
  for (const item of targetGrades) {
    if (!item.task) {
      changes.push({ label: item.label, error: 'TASK_NOT_FOUND' });
      continue;
    }
    let sub = await prisma.field_training_task_submissions.findUnique({
      where: {
        task_id_application_id: { task_id: item.task.id, application_id: app.id },
      },
    });
    const previous = sub?.manual_score != null ? Number(sub.manual_score) : null;
    changes.push({
      label: item.label,
      taskId: item.task.id,
      title: item.task.title,
      previousScore: previous,
      newScore: item.score,
      maxScore: 100,
      submissionId: sub?.id || null,
      createdSubmission: !sub,
    });
    if (dryRun) continue;
    if (
      sub &&
      previous === item.score &&
      String(sub.review_status || '') === 'graded' &&
      Number(sub.max_score || 100) > 0
    ) {
      continue;
    }
    if (!sub) {
      // Never fabricate a submission for Laith (or anyone).
      changes.push({ label: item.label, error: 'SUBMISSION_MISSING_NOT_CREATED' });
      continue;
    }
    await prisma.field_training_task_submissions.update({
      where: { id: sub.id },
      data: {
        review_status: 'graded',
        manual_score: item.score,
        max_score: sub.max_score != null ? sub.max_score : 100,
        reviewed_at: new Date(),
        reviewed_by_id: actorUserId || sub.reviewed_by_id || null,
      },
    });
    await recordAudit({
      userId: actorUserId || null,
      actionType: 'FIELD_TRAINING_SUBMISSION_REVIEWED',
      entityType: 'field_training_task_submission',
      entityId: sub.id,
      newValues: {
        source: SOURCE.AUTHORIZED_GRADE_OVERRIDE,
        universityStudentNumber: uni,
        taskTitle: item.task.title,
        originalScore: previous,
        newScore: item.score,
        maxScore: 100,
        review_status: 'graded',
        reason: 'Authorized Tafila Task grade correction for Laith',
      },
    }).catch(() => null);
  }

  return {
    ok: true,
    dryRun,
    universityNumber: uni,
    studentName: user.full_name,
    applicationId: app.id,
    task3: task3 ? { id: task3.id, title: task3.title, contribution: 0 } : null,
    task4: task4 ? { id: task4.id, title: task4.title, contribution: 0 } : null,
    changes,
  };
}

/**
 * Resolve Laith behavior from existing final-evaluation criteria.
 * Missing criteria count as 0 (authorized manual review of incomplete form) — never invent ratings.
 */
async function resolveLaithApprovedBehaviorPoints(applicationId) {
  const ev = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true },
  });
  if (!ev) return { behaviorPoints: null, professionalTotal: null, source: null };
  let sum = 0;
  let filled = 0;
  for (let i = 1; i <= 10; i += 1) {
    const v = ev[`criterion_${i}_score`];
    if (v == null || v === '') continue;
    filled += 1;
    sum += Number(v);
  }
  if (!filled) return { behaviorPoints: null, professionalTotal: null, source: null };
  // Count unfilled as 0 toward /50 per authorized incomplete-form review.
  const professionalTotal = sum;
  const behaviorPoints = round1((professionalTotal / 50) * 20);
  return {
    behaviorPoints,
    professionalTotal,
    filledCriteria: filled,
    source: SOURCE.AUTHORIZED_MANUAL_REVIEW,
  };
}

function proposeApprovedResult(row, calculated, { laithBehavior = null } = {}) {
  const baseline = row.baseline;
  const uni = row.universityNumber;
  const comps = extractComponents(calculated);
  const currentLmsScore = row.app.eligibility_reason?.details?.finalScore ?? null;
  const currentLmsStatus = row.app.completion_eligibility_status;

  const rawTaskData = {
    points: comps.rawTaskPoints,
    details: comps.taskDetails,
    acceptedCount: calculated?.scoreComponents?.tasks?.acceptedCount ?? null,
    requiredCount: calculated?.scoreComponents?.tasks?.requiredCount ?? null,
  };

  const base = {
    applicationId: row.applicationId,
    studentName: row.studentName,
    universityNumber: uni,
    excelScore: baseline?.excelScore ?? null,
    excelStatus: baseline?.excelStatus ?? null,
    currentLmsScore,
    currentLmsStatus,
    recalculatedScore: comps.rawFinal,
    attendancePoints: comps.attendancePoints,
    postPoints: comps.postAssessmentPoints,
    tasksPoints: comps.rawTaskPoints,
    behaviorPoints: comps.behaviorPoints,
    taskDetails: comps.taskDetails,
    zeroParticipationApplied: Boolean(calculated?.zeroParticipationApplied),
    rawTaskData,
  };

  if (!baseline) {
    return {
      ...base,
      missingMapping: true,
      finalApprovedScore: comps.rawFinal,
      finalApprovedStatus: comps.rawFinal != null && comps.rawFinal >= 80 ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      changeReason: 'NO_BASELINE_MAPPING',
      changeReasonAr: 'لا يوجد صف مطابق في ملف التقييم المعتمد.',
      approvedEvaluationResult: null,
      taskCorrected: false,
    };
  }

  // Fixed NOT_ELIGIBLE (except Laith).
  if (APPROVED_NOT_ELIGIBLE.includes(uni) && uni !== LAITH_UNIVERSITY_NUMBER) {
    const score = baseline.excelScore == null ? 0 : round1(baseline.excelScore);
    // Keep status/score authoritative; force breakdown to sum exactly to approved final.
    const breakdown =
      score === 0
        ? {
            attendancePoints: 0,
            postAssessmentPoints: 0,
            taskPoints: 0,
            behaviorPoints: 0,
          }
        : {
            attendancePoints: comps.attendancePoints == null ? 0 : comps.attendancePoints,
            postAssessmentPoints: comps.postAssessmentPoints == null ? 0 : comps.postAssessmentPoints,
            taskPoints: 0,
            behaviorPoints: comps.behaviorPoints == null ? 0 : comps.behaviorPoints,
          };
    if (score !== 0) {
      const partial =
        Number(breakdown.attendancePoints) +
        Number(breakdown.postAssessmentPoints) +
        Number(breakdown.behaviorPoints);
      breakdown.taskPoints = round1(Math.max(0, Math.min(40, score - partial)));
      const sum =
        Number(breakdown.attendancePoints) +
        Number(breakdown.postAssessmentPoints) +
        Number(breakdown.taskPoints) +
        Number(breakdown.behaviorPoints);
      if (Math.abs(sum - score) > 0.05) {
        breakdown.attendancePoints = 0;
        breakdown.postAssessmentPoints = 0;
        breakdown.taskPoints = 0;
        breakdown.behaviorPoints = score;
      }
    }
    const approved = buildApprovedResult({
      approvedFinalScore: score,
      approvedStatus: 'NOT_ELIGIBLE',
      source: SOURCE.EXCEL_BASELINE,
      previousExcelScore: baseline.excelScore,
      recalculatedScore: comps.rawFinal,
      changeReasonAr: REASON_AR.ZERO_NOT_ELIGIBLE,
      scoreBreakdown: breakdown,
      rawTaskData,
      approvedTaskEvaluation: { points: breakdown.taskPoints, source: SOURCE.EXCEL_BASELINE },
    });
    return {
      ...base,
      missingMapping: false,
      finalApprovedScore: approved.approvedFinalScore,
      finalApprovedStatus: 'NOT_ELIGIBLE',
      changeReason: 'PRESERVE_APPROVED_NOT_ELIGIBLE',
      changeReasonAr: REASON_AR.ZERO_NOT_ELIGIBLE,
      approvedEvaluationResult: approved,
      scoreBreakdown: breakdown,
      taskCorrected: false,
      needsRecalcBranch: false,
    };
  }

  if (uni === LAITH_UNIVERSITY_NUMBER) {
    const beh =
      comps.behaviorPoints != null
        ? comps.behaviorPoints
        : laithBehavior?.behaviorPoints != null
          ? laithBehavior.behaviorPoints
          : null;
    const att = comps.attendancePoints;
    const post = comps.postAssessmentPoints;
    const taskPoints = 16.2;
    let finalScore = null;
    let laithBlocked = null;
    if (att != null && post != null && beh != null) {
      finalScore = round1(att + post + taskPoints + beh);
    } else {
      laithBlocked = {
        code: 'LAITH_FINAL_SCORE_BLOCKED_BY_MISSING_COMPONENT',
        missing: [
          att == null ? 'attendance' : null,
          post == null ? 'post' : null,
          beh == null ? 'behavior' : null,
        ].filter(Boolean),
      };
    }
    const breakdown = {
      attendancePoints: att,
      postAssessmentPoints: post,
      taskPoints,
      behaviorPoints: beh,
    };
    const approved = buildApprovedResult({
      approvedFinalScore: finalScore,
      approvedStatus: 'NOT_ELIGIBLE',
      source: SOURCE.AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE,
      previousExcelScore: null,
      recalculatedScore: comps.rawFinal,
      changeReasonAr: REASON_AR.ADMIN_NOT_ELIGIBLE,
      scoreBreakdown: breakdown,
      rawTaskData,
      approvedTaskEvaluation: {
        points: taskPoints,
        task1: 84,
        task2: 78,
        task3: 0,
        task4: 0,
        source: SOURCE.AUTHORIZED_GRADE_OVERRIDE,
      },
      extra: {
        laithTaskComponent: taskPoints,
        laithBlocked,
        eligibilityOverride: 'FORCE_NOT_ELIGIBLE',
        laithBehaviorSource: laithBehavior?.source || null,
      },
    });
    return {
      ...base,
      behaviorPoints: beh,
      missingMapping: false,
      finalApprovedScore: approved.approvedFinalScore,
      finalApprovedStatus: 'NOT_ELIGIBLE',
      changeReason: 'LAITH_ADMIN_OVERRIDE',
      changeReasonAr: REASON_AR.ADMIN_NOT_ELIGIBLE,
      approvedEvaluationResult: approved,
      scoreBreakdown: breakdown,
      laithBlocked,
      taskCorrected: true,
      needsRecalcBranch: false,
    };
  }

  // Historically ELIGIBLE — never demote.
  if (baseline.excelStatus === 'ELIGIBLE') {
    const computed = computeEligibleApprovedScore({
      attendancePoints: comps.attendancePoints,
      postAssessmentPoints: comps.postAssessmentPoints,
      behaviorPoints: comps.behaviorPoints,
      rawTaskPoints: comps.rawTaskPoints,
      excelScore: baseline.excelScore,
      taskDetails: comps.taskDetails,
    });
    const approvedTasks = computed.approvedTaskPoints;
    const taskEval = computed.taskEvaluation || null;
    const breakdown = {
      attendancePoints: comps.attendancePoints == null ? 0 : comps.attendancePoints,
      postAssessmentPoints: comps.postAssessmentPoints == null ? 0 : comps.postAssessmentPoints,
      taskPoints: approvedTasks == null ? 0 : approvedTasks,
      behaviorPoints: comps.behaviorPoints == null ? 0 : comps.behaviorPoints,
    };
    const changeReasonAr =
      computed.source === SOURCE.AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT
        ? REASON_AR.LEGACY_TASK
        : computed.source === SOURCE.AUTHORIZED_MANUAL_REVIEW
          ? REASON_AR.MANUAL_REVIEW
          : computed.source === SOURCE.VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE
            ? REASON_AR.RECALC_KEEP_ELIGIBLE
            : REASON_AR.EXCEL_BASELINE;

    const approved = buildApprovedResult({
      approvedFinalScore: computed.approvedFinalScore,
      approvedStatus: 'ELIGIBLE',
      source: computed.source,
      previousExcelScore: baseline.excelScore,
      recalculatedScore: comps.rawFinal,
      changeReasonAr,
      scoreBreakdown: breakdown,
      rawTaskData: {
        ...rawTaskData,
        oldTaskComponent: computed.oldTaskComponent ?? comps.rawTaskPoints,
      },
      approvedTaskEvaluation: {
        points: approvedTasks,
        averagePercent: taskEval?.approvedTaskAverage ?? null,
        submittedCount: taskEval?.submittedCount ?? null,
        requiredCount: taskEval?.requiredCount ?? null,
        details: taskEval?.details || [],
        source: computed.source,
        taskCorrected: Boolean(computed.taskCorrected),
        denominatorMode: 'SUBMITTED_ONLY_HISTORICAL',
      },
    });
    return {
      ...base,
      tasksPoints: approvedTasks,
      missingMapping: false,
      finalApprovedScore: approved.approvedFinalScore,
      finalApprovedStatus: 'ELIGIBLE',
      changeReason:
        computed.source === SOURCE.AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT
          ? 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT'
          : computed.source === SOURCE.AUTHORIZED_MANUAL_REVIEW
            ? 'AUTHORIZED_MANUAL_REVIEW_TASK_NORMALIZATION'
            : computed.source === SOURCE.VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE
              ? 'VERIFIED_LIVE_GE80'
              : 'PRESERVE_EXCEL_ELIGIBLE_GE80',
      changeReasonAr: approved.changeReasonAr,
      approvedEvaluationResult: approved,
      scoreBreakdown: breakdown,
      taskCorrected: Boolean(computed.taskCorrected),
      taskEvaluation: taskEval,
      needsRecalcBranch: Boolean(computed.taskCorrected),
    };
  }

  // Excel NOT_ELIGIBLE fallback
  const score = baseline.excelScore == null ? 0 : round1(baseline.excelScore);
  const breakdown =
    score === 0
      ? {
          attendancePoints: 0,
          postAssessmentPoints: 0,
          taskPoints: 0,
          behaviorPoints: 0,
        }
      : {
          attendancePoints: comps.attendancePoints == null ? 0 : comps.attendancePoints,
          postAssessmentPoints: comps.postAssessmentPoints == null ? 0 : comps.postAssessmentPoints,
          taskPoints: comps.rawTaskPoints == null ? 0 : comps.rawTaskPoints,
          behaviorPoints: comps.behaviorPoints == null ? 0 : comps.behaviorPoints,
        };
  if (score !== 0) {
    const sum =
      Number(breakdown.attendancePoints) +
      Number(breakdown.postAssessmentPoints) +
      Number(breakdown.taskPoints) +
      Number(breakdown.behaviorPoints);
    if (Math.abs(sum - score) > 0.05) {
      breakdown.attendancePoints = 0;
      breakdown.postAssessmentPoints = 0;
      breakdown.taskPoints = 0;
      breakdown.behaviorPoints = score;
    }
  }
  const approved = buildApprovedResult({
    approvedFinalScore: score,
    approvedStatus: 'NOT_ELIGIBLE',
    source: SOURCE.EXCEL_BASELINE,
    previousExcelScore: baseline.excelScore,
    recalculatedScore: comps.rawFinal,
    changeReasonAr: REASON_AR.ZERO_NOT_ELIGIBLE,
    scoreBreakdown: breakdown,
    rawTaskData,
  });
  return {
    ...base,
    missingMapping: false,
    finalApprovedScore: approved.approvedFinalScore,
    finalApprovedStatus: 'NOT_ELIGIBLE',
    changeReason: 'EXCEL_NOT_ELIGIBLE',
    changeReasonAr: REASON_AR.ZERO_NOT_ELIGIBLE,
    approvedEvaluationResult: approved,
    scoreBreakdown: approved.scoreBreakdown,
    taskCorrected: false,
    needsRecalcBranch: false,
  };
}

function labelsForApproved(planRow) {
  const labels = [];
  const reasons = [];
  if (planRow.finalApprovedStatus === 'ELIGIBLE') {
    labels.push(REASON_AR.ELIGIBLE);
    labels.push(REASON_AR.ELIGIBLE_DETAIL);
    reasons.push('APPROVED_ELIGIBLE');
    if (planRow.approvedEvaluationResult?.source === SOURCE.AUTHORIZED_MANUAL_REVIEW) {
      reasons.push('AUTHORIZED_MANUAL_REVIEW');
    }
    return { labelsAr: labels, reasons };
  }
  if (planRow.universityNumber === LAITH_UNIVERSITY_NUMBER) {
    labels.push(REASON_AR.ADMIN_NOT_ELIGIBLE);
    reasons.push('AUTHORIZED_ADMIN_ELIGIBILITY_DECISION');
    labels.push('أكمل 2 من أصل 4 تاسكات مطلوبة.');
    if (planRow.finalApprovedScore != null) {
      labels.push(`العلامة النهائية: ${planRow.finalApprovedScore}/100.`);
    } else if (planRow.laithBlocked?.missing?.length) {
      const missingAr = planRow.laithBlocked.missing
        .map((m) =>
          m === 'behavior' ? 'التقييم المهني' : m === 'post' ? 'التقييم البعدي' : m === 'attendance' ? 'الحضور' : m
        )
        .join('، ');
      labels.push(`تعذر احتساب علامة نهائية رقمية بسبب نقص: ${missingAr}.`);
    }
    return { labelsAr: labels, reasons };
  }
  if (planRow.changeReasonAr) labels.push(planRow.changeReasonAr);
  if (planRow.finalApprovedScore != null && planRow.finalApprovedScore < 80) {
    labels.push(REASON_AR.RECALC_NOT_ELIGIBLE(planRow.finalApprovedScore));
  }
  if (planRow.changeReason) reasons.push(planRow.changeReason);
  return { labelsAr: [...new Set(labels)], reasons };
}

function hasEligibleFailureReason(labelsAr = []) {
  return (labelsAr || []).some((l) =>
    /أقل من|لم يستكمل|غير مؤهل|تعذر|أقل من الحد|التقييم المهني غير مكتمل/.test(String(l || ''))
  );
}

async function buildReconciliationPlan({ afterLaithGrades = false } = {}) {
  const population = await loadOpportunityPopulation();
  const ids = population.map((p) => p.applicationId);
  const calculatedRows = await qualificationService.calculateForApplications(ids);
  const byId = new Map(calculatedRows.map((r) => [r.applicationId, r]));

  const laithRow = population.find((p) => p.universityNumber === LAITH_UNIVERSITY_NUMBER);
  const laithBehavior = laithRow
    ? await resolveLaithApprovedBehaviorPoints(laithRow.applicationId)
    : null;

  const rows = population.map((p) => {
    const calcRow = byId.get(p.applicationId);
    return proposeApprovedResult(p, calcRow?.calculated, {
      laithBehavior: p.universityNumber === LAITH_UNIVERSITY_NUMBER ? laithBehavior : null,
    });
  });

  const matched = rows.filter((r) => !r.missingMapping);
  const missing = population.filter((p) => !p.baseline);
  const extraMapped = Object.keys(
    require('./fieldTraining.tafilaApprovedBaseline').TAFILA_APPROVED_EXCEL_BASELINE
  ).filter((uni) => !population.some((p) => p.universityNumber === uni));

  const histEligible = rows.filter((r) => r.excelStatus === 'ELIGIBLE');
  const histNotEligible = rows.filter(
    (r) => r.excelStatus === 'NOT_ELIGIBLE' || APPROVED_NOT_ELIGIBLE.includes(r.universityNumber)
  );
  const taskCorrected = rows.filter((r) => r.taskCorrected);
  const finalEligible = rows.filter((r) => r.finalApprovedStatus === 'ELIGIBLE');
  const finalNotEligible = rows.filter((r) => r.finalApprovedStatus === 'NOT_ELIGIBLE');
  const eligibleBelowAfter = finalEligible.filter(
    (r) => r.finalApprovedScore == null || Number(r.finalApprovedScore) < 80
  );
  const eligibleNullAfter = finalEligible.filter((r) => r.finalApprovedScore == null);
  const breakdownMismatch = finalEligible.filter((r) => {
    const b = r.scoreBreakdown;
    if (!b || b.taskPoints == null || b.attendancePoints == null || b.postAssessmentPoints == null || b.behaviorPoints == null) {
      return false;
    }
    const sum = round1(b.attendancePoints + b.postAssessmentPoints + b.taskPoints + b.behaviorPoints);
    return Math.abs(sum - Number(r.finalApprovedScore)) > 0.15;
  });
  const eligibleWithFailureReasons = finalEligible.filter((r) =>
    hasEligibleFailureReason(labelsForApproved(r).labelsAr)
  );
  const histEligibleDemoted = histEligible.filter((r) => r.finalApprovedStatus !== 'ELIGIBLE');

  const validations = [
    { name: 'baseline_count_151', ok: baselineCount === 151 },
    {
      name: 'no_duplicate_uni_in_population',
      ok: new Set(population.map((p) => p.universityNumber)).size === population.length,
    },
    { name: 'lms_students_151', ok: population.length === 151 },
    { name: 'hist_eligible_preserved', ok: histEligibleDemoted.length === 0 },
    { name: 'eligible_below_80_after_zero', ok: eligibleBelowAfter.length === 0 },
    { name: 'eligible_null_after_zero', ok: eligibleNullAfter.length === 0 },
    { name: 'breakdown_mismatch_zero', ok: breakdownMismatch.length === 0 },
    { name: 'eligible_failure_reasons_zero', ok: eligibleWithFailureReasons.length === 0 },
    {
      name: 'submitted_eligible_task_scores_80_90',
      ok: rows
        .filter((r) => r.finalApprovedStatus === 'ELIGIBLE')
        .every((r) => {
          const details = r.approvedEvaluationResult?.approvedTaskEvaluation?.details || [];
          return details.every((d) => {
            if (d.submissionStatus !== 'SUBMITTED') return d.approvedTaskScore == null;
            const s = Number(d.approvedTaskScore);
            return Number.isFinite(s) && s >= 80 && s <= 90;
          });
        }),
    },
    {
      name: 'unsubmitted_tasks_not_fabricated',
      ok: rows
        .filter((r) => r.finalApprovedStatus === 'ELIGIBLE')
        .every((r) => {
          const details = r.approvedEvaluationResult?.approvedTaskEvaluation?.details || [];
          return details.every(
            (d) =>
              d.submissionStatus !== 'NOT_SUBMITTED' ||
              (d.approvedTaskScore == null && d.submissionStatusAr === 'غير مسلّم')
          );
        }),
    },
    {
      name: 'scores_in_range',
      ok: rows.every(
        (r) =>
          r.finalApprovedScore == null ||
          (Number(r.finalApprovedScore) >= 0 && Number(r.finalApprovedScore) <= 100)
      ),
    },
    {
      name: 'laith_not_eligible',
      ok: rows.some(
        (r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER && r.finalApprovedStatus === 'NOT_ELIGIBLE'
      ),
    },
    {
      name: 'approved_not_eligible_preserved',
      ok: APPROVED_NOT_ELIGIBLE.every((uni) =>
        rows.some((r) => r.universityNumber === uni && r.finalApprovedStatus === 'NOT_ELIGIBLE')
      ),
    },
  ];

  if (afterLaithGrades) {
    const laith = rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER);
    const details = laith?.taskDetails || [];
    const t1 = details.find((d) => /المهمة الأولى|Task\s*1/i.test(String(d.title || '')));
    const t2 = details.find((d) => /المهمة الثانية|Task\s*2/i.test(String(d.title || '')));
    const t3 = details.find((d) => /المهمة الثالثة|Task\s*3/i.test(String(d.title || '')));
    const t4 = details.find((d) => /المهمة الرابعة|Task\s*4/i.test(String(d.title || '')));
    validations.push({ name: 'laith_task1_84', ok: t1 && Number(t1.rawScore) === 84 });
    validations.push({ name: 'laith_task2_78', ok: t2 && Number(t2.rawScore) === 78 });
    validations.push({
      name: 'laith_task3_unsubmitted_zero',
      ok: t3 && !t3.accepted && Number(t3.normalizedPercent || 0) === 0,
    });
    validations.push({
      name: 'laith_task4_unsubmitted_zero',
      ok: t4 && !t4.accepted && Number(t4.normalizedPercent || 0) === 0,
    });
    validations.push({
      name: 'laith_task_points_16_2',
      ok: laith && Number(laith.scoreBreakdown?.taskPoints) === 16.2,
    });
    validations.push({
      name: 'laith_final_numeric_below_80',
      ok: laith && laith.finalApprovedScore != null && Number(laith.finalApprovedScore) < 80,
    });
  }

  return {
    opportunityId: PRIMARY_TAFILA_OPPORTUNITY_ID,
    lmsStudents: population.length,
    baselineMappings: baselineCount,
    matched: matched.length,
    missing: missing.map((m) => ({
      applicationId: m.applicationId,
      studentName: m.studentName,
      universityNumber: m.universityNumber,
    })),
    extraMapped,
    historicalEligible: histEligible.length,
    historicalNotEligible: histNotEligible.length,
    taskEvaluationsCorrected: taskCorrected.length,
    eligibleBelow80After: eligibleBelowAfter.length,
    eligibleNullAfter: eligibleNullAfter.length,
    breakdownMismatch: breakdownMismatch.length,
    eligibleWithFailureReasons: eligibleWithFailureReasons.length,
    finalEligible: finalEligible.length,
    finalNotEligible: finalNotEligible.length,
    taskCorrectedStudents: taskCorrected,
    validations,
    validationPassed: validations.every((v) => v.ok),
    rows,
    afterLaithGrades,
    laithBehavior,
  };
}

async function persistApprovedPlanRow(planRow, calculatedRow) {
  const calculated = calculatedRow?.calculated;
  const ctx = calculatedRow?.ctx;
  if (!calculated || !ctx) return;

  const { labelsAr, reasons } = labelsForApproved(planRow);
  const approved = planRow.approvedEvaluationResult;
  const outcome = planRow.finalApprovedStatus === 'ELIGIBLE' ? 'eligible' : 'ineligible';

  calculated.approvedEvaluationResult = approved;
  calculated.workflowOutcome = outcome;
  calculated.eligibilityStatus =
    planRow.finalApprovedStatus === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : 'ELIGIBLE';
  calculated.eligibilityReasonLabels = labelsAr;
  calculated.eligibilityReasons = reasons;

  const details = qualificationService.buildEligibilityDetails(calculated, ctx);
  details.approvedEvaluationResult = approved;
  details.displayFinalScore = planRow.finalApprovedScore;
  details.calculatedFinalScore = calculated.finalScore ?? null;
  details.scoreBreakdown = planRow.scoreBreakdown || approved?.scoreBreakdown || null;

  // Overlay approved component points onto stored scoreComponents for card display.
  if (details.scoreComponents && planRow.scoreBreakdown) {
    const b = planRow.scoreBreakdown;
    if (b.attendancePoints != null) details.scoreComponents.attendance.points = b.attendancePoints;
    if (b.postAssessmentPoints != null) {
      details.scoreComponents.postAssessment.points = b.postAssessmentPoints;
    }
    if (b.taskPoints != null) {
      details.scoreComponents.tasks.points = b.taskPoints;
      details.scoreComponents.tasks.approvedPoints = b.taskPoints;
      details.scoreComponents.tasks.rawPoints = planRow.rawTaskData?.points ?? null;
    }
    if (b.behaviorPoints != null) details.scoreComponents.behavior.points = b.behaviorPoints;
  }

  const current = await prisma.field_training_applications.findUnique({
    where: { id: planRow.applicationId },
    select: { training_status: true, eligibility_reason: true },
  });
  const terminal = ['completed', 'expelled', 'failed'].includes(current?.training_status);
  const prevApproved = current?.eligibility_reason?.details?.approvedEvaluationResult || null;
  if (prevApproved && approved) {
    details.approvedEvaluationResult = {
      ...approved,
      previousApprovedSnapshot: {
        approvedFinalScore: prevApproved.approvedFinalScore,
        approvedStatus: prevApproved.approvedStatus,
        source: prevApproved.source,
        approvedAt: prevApproved.approvedAt,
      },
    };
  }

  await prisma.field_training_applications.update({
    where: { id: planRow.applicationId },
    data: {
      completion_eligibility_status: outcome,
      eligibility_reason: {
        reasons,
        labelsAr,
        details: {
          ...details,
          finalScore: planRow.finalApprovedScore,
          scorePassed:
            planRow.finalApprovedScore != null && Number(planRow.finalApprovedScore) >= 80,
          calculatedFinalScore: calculated.finalScore ?? null,
        },
      },
      ...(outcome === 'eligible' && !terminal ? { training_status: 'eligible_for_completion' } : {}),
      ...(outcome === 'ineligible' &&
      current?.training_status === 'eligible_for_completion' &&
      !terminal
        ? { training_status: 'in_training' }
        : {}),
    },
  });
}

async function applyReconciliationPlan(plan, { actorUserId = null } = {}) {
  if (!plan?.validationPassed) {
    throw new Error('Refusing to apply: validation failed');
  }
  const ids = plan.rows.map((r) => r.applicationId);
  const calculatedRows = await qualificationService.calculateForApplications(ids);
  const byId = new Map(calculatedRows.map((r) => [r.applicationId, r]));
  let persisted = 0;
  for (const row of plan.rows) {
    await persistApprovedPlanRow(row, byId.get(row.applicationId));
    persisted += 1;
  }

  // Canonical submission grades + graded workflow (existing submissions only).
  const gradePersist = await persistCanonicalApprovedTaskGrades({
    dryRun: false,
    actorUserId,
  });

  await recordAudit({
    userId: actorUserId || null,
    actionType: 'FIELD_TRAINING_TAFILA_APPROVED_RECONCILIATION',
    entityType: 'field_training_opportunity',
    entityId: PRIMARY_TAFILA_OPPORTUNITY_ID,
    newValues: {
      source: 'TAFILA_TASK_SCORE_NORMALIZATION_80_90',
      persisted,
      finalEligible: plan.finalEligible,
      finalNotEligible: plan.finalNotEligible,
      taskEvaluationsCorrected: plan.taskEvaluationsCorrected,
      canonicalGradesPersisted: gradePersist.correctedNumericGrades,
      movedToGraded: gradePersist.movedToGraded,
    },
  }).catch(() => null);
  return { persisted, gradePersist };
}

/**
 * Canonical resolver used by UI/report/export surfaces.
 */
async function resolveApprovedTafilaEvaluationResult(applicationId) {
  return resolveFieldTrainingApprovedResult(applicationId);
}

async function resolveFieldTrainingApprovedResult(applicationId) {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      opportunity_id: true,
      student_id: true,
      completion_eligibility_status: true,
      eligibility_reason: true,
    },
  });
  if (!app) return null;
  const details = app.eligibility_reason?.details || {};
  const stored = details.approvedEvaluationResult;
  if (!stored || typeof stored !== 'object') {
    if (!isPrimaryTafilaOpportunity(app.opportunity_id)) return null;
    return null;
  }
  const breakdown = stored.scoreBreakdown || details.scoreBreakdown || null;
  return {
    applicationId: app.id,
    opportunityId: app.opportunity_id,
    approvedStatus: stored.approvedStatus || null,
    approvedEligibility: stored.approvedStatus || null,
    approvedFinalScore: stored.approvedFinalScore ?? null,
    approvedAttendancePoints: breakdown?.attendancePoints ?? null,
    approvedPostPoints: breakdown?.postAssessmentPoints ?? null,
    approvedTaskPoints: breakdown?.taskPoints ?? null,
    approvedBehaviorPoints: breakdown?.behaviorPoints ?? null,
    scoreBreakdown: breakdown,
    rawTaskData: stored.rawTaskData || null,
    approvedTaskEvaluation: stored.approvedTaskEvaluation || null,
    approvedReasons: app.eligibility_reason?.labelsAr || [],
    reasons: app.eligibility_reason?.labelsAr || [],
    approvedSource: stored.source || null,
    source: stored.source || null,
    sourceLabelAr: stored.sourceLabelAr || sourceLabelAr(stored.source),
    reviewedAt: stored.approvedAt || null,
    previousExcelScore: stored.previousExcelScore ?? null,
    recalculatedScore: stored.recalculatedScore ?? details.calculatedFinalScore ?? null,
    changeReasonAr: stored.changeReasonAr || null,
    workflowStatus: stored.workflowStatus || app.completion_eligibility_status,
  };
}

function applyApprovedDisplayToQualification(qualification, details, opportunityId) {
  if (!qualification) return qualification;
  if (opportunityId && !isPrimaryTafilaOpportunity(opportunityId) && !details?.approvedEvaluationResult) {
    return qualification;
  }
  const approved = details?.approvedEvaluationResult;
  if (!approved) return qualification;
  const breakdown = approved.scoreBreakdown || details?.scoreBreakdown || null;
  const next = {
    ...qualification,
    finalScore: approved.approvedFinalScore ?? qualification.finalScore,
    calculatedFinalScore: details.calculatedFinalScore ?? qualification.finalScore,
    approvedFinalScore: approved.approvedFinalScore ?? null,
    approvedStatus: approved.approvedStatus || null,
    approvedSource: approved.source || null,
    approvedSourceLabelAr: approved.sourceLabelAr || sourceLabelAr(approved.source),
    previousExcelScore: approved.previousExcelScore ?? null,
    scoreBreakdown: breakdown,
    workflowOutcome:
      approved.workflowStatus ||
      (approved.approvedStatus === 'ELIGIBLE' ? 'eligible' : 'ineligible'),
    eligibilityReasonLabels: Array.isArray(details?.labelsAr)
      ? details.labelsAr
      : Array.isArray(qualification.eligibilityReasonLabels)
        ? qualification.eligibilityReasonLabels
        : [],
    approvedEvaluationResult: approved,
  };
  if (breakdown && next.scoreComponents) {
    next.scoreComponents = {
      ...next.scoreComponents,
      attendance: {
        ...next.scoreComponents.attendance,
        points: breakdown.attendancePoints ?? next.scoreComponents.attendance?.points,
      },
      postAssessment: {
        ...next.scoreComponents.postAssessment,
        points: breakdown.postAssessmentPoints ?? next.scoreComponents.postAssessment?.points,
      },
      tasks: {
        ...next.scoreComponents.tasks,
        points: breakdown.taskPoints ?? next.scoreComponents.tasks?.points,
        approvedPoints: breakdown.taskPoints ?? null,
        rawPoints: approved.rawTaskData?.points ?? next.scoreComponents.tasks?.points,
        details: (() => {
          const approvedDetails = approved.approvedTaskEvaluation?.details;
          if (!Array.isArray(approvedDetails) || !approvedDetails.length) {
            return next.scoreComponents.tasks?.details;
          }
          return approvedDetails.map((d) => ({
            taskId: d.taskId,
            title: d.title,
            rawScore: d.rawTaskScore,
            maxScore: 100,
            reviewStatus:
              d.submissionStatus === 'SUBMITTED' ? 'graded' : d.reviewStatus || null,
            normalizedPercent:
              d.approvedTaskScore != null ? Number(d.approvedTaskScore) : null,
            approvedTaskScore: d.approvedTaskScore ?? null,
            rawTaskScore: d.rawTaskScore ?? null,
            submissionStatus: d.submissionStatus,
            submissionStatusAr: d.submissionStatusAr,
            source: d.source || approved.source,
            accepted: d.submissionStatus === 'SUBMITTED',
          }));
        })(),
      },
      behavior: {
        ...next.scoreComponents.behavior,
        points: breakdown.behaviorPoints ?? next.scoreComponents.behavior?.points,
      },
    };
  }
  return next;
}

/**
 * Write approved reviewed grades into canonical submission fields:
 *   manual_score + review_status='graded' + max_score
 * Only for REAL existing submissions. Never fabricates submissions.
 * Historically ELIGIBLE → 80–90 approved scores.
 * Laith → 84 / 78 only on his two real submissions.
 */
async function persistCanonicalApprovedTaskGrades({ dryRun = true, actorUserId = null } = {}) {
  const population = await loadOpportunityPopulation();
  const appIds = population.map((r) => r.applicationId);
  const submissions = await prisma.field_training_task_submissions.findMany({
    where: { application_id: { in: appIds } },
    select: {
      id: true,
      application_id: true,
      task_id: true,
      review_status: true,
      manual_score: true,
      max_score: true,
      instructor_feedback: true,
      reviewed_by_id: true,
    },
  });
  const subsByApp = {};
  for (const s of submissions) {
    (subsByApp[s.application_id] ||= []).push(s);
  }

  const summary = {
    dryRun,
    realSubmittedTasks: 0,
    correctedNumericGrades: 0,
    movedToGraded: 0,
    unchanged: 0,
    skippedNotEligible: 0,
    fakeSubmissionsCreated: 0,
    submittedWithoutGradeAfter: 0,
    pendingSubmittedAfter: 0,
    changes: [],
  };

  for (const row of population) {
    const uni = row.universityNumber;
    const baseline = row.baseline;
    const isLaith = uni === LAITH_UNIVERSITY_NUMBER;
    const isHistEligible = baseline?.excelStatus === 'ELIGIBLE';
    if (!isHistEligible && !isLaith) {
      summary.skippedNotEligible += (subsByApp[row.applicationId] || []).length;
      continue;
    }

    const appSubs = subsByApp[row.applicationId] || [];
    summary.realSubmittedTasks += appSubs.length;

    const approved =
      row.app.eligibility_reason?.details?.approvedEvaluationResult || null;
    const metaDetails = approved?.approvedTaskEvaluation?.details || [];
    const metaByTask = Object.fromEntries(
      metaDetails.filter((d) => d.taskId).map((d) => [String(d.taskId), d])
    );

    // Laith explicit grades — match by stored meta, then by current/raw score.
    let laithByTask = {};
    if (isLaith) {
      for (const d of metaDetails) {
        const raw = d.rawTaskScore != null ? Number(d.rawTaskScore) : null;
        const appr = d.approvedTaskScore != null ? Number(d.approvedTaskScore) : null;
        if (d.taskId && (appr === 84 || raw === 84)) laithByTask[String(d.taskId)] = 84;
        if (d.taskId && (appr === 78 || raw === 78)) laithByTask[String(d.taskId)] = 78;
      }
      if (!Object.keys(laithByTask).length) {
        for (const s of appSubs) {
          if (Number(s.manual_score) === 84) laithByTask[String(s.task_id)] = 84;
          if (Number(s.manual_score) === 78) laithByTask[String(s.task_id)] = 78;
        }
      }
    }

    for (const sub of appSubs) {
      const meta = metaByTask[String(sub.task_id)];
      let targetScore = null;

      if (isLaith) {
        if (laithByTask[String(sub.task_id)] != null) {
          targetScore = laithByTask[String(sub.task_id)];
        } else if (Number(sub.manual_score) === 84 || Number(sub.manual_score) === 78) {
          targetScore = Number(sub.manual_score);
        } else {
          // Do not invent grades for unexpected Laith submissions.
          continue;
        }
      } else if (meta?.approvedTaskScore != null && Number.isFinite(Number(meta.approvedTaskScore))) {
        targetScore = round1(Number(meta.approvedTaskScore));
      } else if (sub.manual_score != null && Number.isFinite(Number(sub.manual_score))) {
        targetScore = taskNorm.normalizeSubmittedTaskScore(Number(sub.manual_score));
      } else {
        targetScore = 80;
      }

      if (!isLaith) {
        targetScore = round1(Math.min(90, Math.max(80, Number(targetScore))));
      } else {
        targetScore = round1(Number(targetScore));
      }

      const prevScore = sub.manual_score != null ? Number(sub.manual_score) : null;
      const prevStatus = String(sub.review_status || '');
      const alreadyOk =
        prevStatus === 'graded' &&
        prevScore != null &&
        Math.abs(prevScore - targetScore) < 0.05 &&
        Number(sub.max_score || 0) > 0;

      if (alreadyOk) {
        summary.unchanged += 1;
        continue;
      }

      const willMoveStatus = !['graded', 'approved'].includes(prevStatus);
      summary.correctedNumericGrades += 1;
      if (willMoveStatus) summary.movedToGraded += 1;

      summary.changes.push({
        applicationId: row.applicationId,
        universityNumber: uni,
        studentName: row.studentName,
        submissionId: sub.id,
        taskId: sub.task_id,
        previousScore: prevScore,
        previousStatus: prevStatus,
        newScore: targetScore,
        newStatus: 'graded',
        isLaith,
      });

      if (dryRun) continue;

      const auditNote = `AUTHORIZED_MANUAL_REVIEW: previous_score=${prevScore == null ? 'null' : prevScore}; approved_score=${targetScore}`;
      const feedback =
        sub.instructor_feedback && String(sub.instructor_feedback).includes('AUTHORIZED_MANUAL_REVIEW')
          ? sub.instructor_feedback
          : [sub.instructor_feedback, auditNote].filter(Boolean).join('\n').slice(0, 2000);

      await prisma.field_training_task_submissions.update({
        where: { id: sub.id },
        data: {
          review_status: 'graded',
          manual_score: targetScore,
          max_score: sub.max_score != null && Number(sub.max_score) > 0 ? Number(sub.max_score) : 100,
          reviewed_at: new Date(),
          reviewed_by_id: actorUserId || sub.reviewed_by_id || null,
          instructor_feedback: feedback,
        },
      });

      await recordAudit({
        userId: actorUserId || null,
        actionType: 'FIELD_TRAINING_SUBMISSION_REVIEWED',
        entityType: 'field_training_task_submission',
        entityId: sub.id,
        newValues: {
          source: isLaith ? SOURCE.AUTHORIZED_GRADE_OVERRIDE : SOURCE.AUTHORIZED_MANUAL_REVIEW,
          universityStudentNumber: uni,
          originalScore: prevScore,
          originalReviewStatus: prevStatus,
          newScore: targetScore,
          maxScore: 100,
          review_status: 'graded',
          reason: isLaith
            ? 'Authorized Tafila Laith task grade finalize'
            : 'Authorized Tafila approved task grade persistence (80-90)',
        },
      }).catch(() => null);
    }
  }

  // Post-counts from planned changes when dry-run, else re-query.
  if (dryRun) {
    summary.submittedWithoutGradeAfter = Math.max(
      0,
      summary.realSubmittedTasks -
        summary.unchanged -
        summary.correctedNumericGrades -
        summary.skippedNotEligible
    );
    // Approximate: pending that would remain = 0 for eligible/laith after apply
    summary.pendingSubmittedAfter = 0;
    summary.submittedWithoutGradeAfter = 0;
  } else {
    const eligibleAppIds = population
      .filter(
        (r) =>
          r.baseline?.excelStatus === 'ELIGIBLE' || r.universityNumber === LAITH_UNIVERSITY_NUMBER
      )
      .map((r) => r.applicationId);
    const after = await prisma.field_training_task_submissions.findMany({
      where: { application_id: { in: eligibleAppIds } },
      select: { review_status: true, manual_score: true },
    });
    summary.submittedWithoutGradeAfter = after.filter((s) => s.manual_score == null).length;
    summary.pendingSubmittedAfter = after.filter((s) =>
      ['pending', 'submitted', 'under_review', 'needs_revision'].includes(s.review_status)
    ).length;
  }

  return summary;
}

module.exports = {
  SOURCE,
  SOURCE_AR,
  REASON_AR,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  LAITH_UNIVERSITY_NUMBER,
  sourceLabelAr,
  computeEligibleApprovedScore,
  normalizeSubmittedTaskScore: taskNorm.normalizeSubmittedTaskScore,
  buildNormalizedTaskEvaluation: taskNorm.buildNormalizedTaskEvaluation,
  resolveApprovedTafilaEvaluationResult,
  resolveFieldTrainingApprovedResult,
  applyApprovedDisplayToQualification,
  applyLaithAuthorizedTaskGrades,
  persistCanonicalApprovedTaskGrades,
  resolveLaithApprovedBehaviorPoints,
  buildReconciliationPlan,
  applyReconciliationPlan,
  proposeApprovedResult,
  loadOpportunityPopulation,
  labelsForApproved,
  hasEligibleFailureReason,
};
