'use strict';

const {
  ACCEPTED_TASK_STATUSES,
  DEFAULT_POLICY,
  FINAL_STATUS,
  GATE_REASON_LABELS_AR,
  GATE_REASONS,
  SCORING_MODEL,
  TASKS_SCORING_MODE,
  DEFAULT_SCORING_RULES,
  ZERO_PARTICIPATION_LABELS_AR,
  ZERO_PARTICIPATION_POLICY_V1,
} = require('./fieldTrainingEvaluation.constants');
const scoring = require('./fieldTrainingEvaluation.scoring');
const {
  resolveEligibilityOverride,
  ELIGIBILITY_OVERRIDE_TYPE,
} = require('./fieldTraining.eligibilityOverrides');

function toNumber(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round1(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function round2(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

function clamp0to100(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
}

function parseScoringRules(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const zeroSrc =
    src.zeroParticipationPolicy && typeof src.zeroParticipationPolicy === 'object'
      ? src.zeroParticipationPolicy
      : null;
  return {
    model: src.model || DEFAULT_SCORING_RULES.model,
    tasksScoringMode: src.tasksScoringMode || DEFAULT_SCORING_RULES.tasksScoringMode,
    renormalizeMissingComponents:
      src.renormalizeMissingComponents == null
        ? DEFAULT_SCORING_RULES.renormalizeMissingComponents
        : Boolean(src.renormalizeMissingComponents),
    preAssessmentRequired:
      src.preAssessmentRequired == null
        ? DEFAULT_SCORING_RULES.preAssessmentRequired
        : Boolean(src.preAssessmentRequired),
    enforcePostAssessmentMinimum:
      src.enforcePostAssessmentMinimum == null
        ? DEFAULT_SCORING_RULES.enforcePostAssessmentMinimum
        : Boolean(src.enforcePostAssessmentMinimum),
    scoreRequiredForEligibility:
      src.scoreRequiredForEligibility == null
        ? DEFAULT_SCORING_RULES.scoreRequiredForEligibility
        : Boolean(src.scoreRequiredForEligibility),
    code: src.code || null,
    zeroParticipationPolicy: zeroSrc
      ? {
          enabled: zeroSrc.enabled !== false,
          code: zeroSrc.code || ZERO_PARTICIPATION_POLICY_V1.code,
          requireMissingPreAssessment: zeroSrc.requireMissingPreAssessment !== false,
          requireZeroSubmittedRequiredTasks: zeroSrc.requireZeroSubmittedRequiredTasks !== false,
        }
      : null,
    eligibilityOverrides: Array.isArray(src.eligibilityOverrides) ? src.eligibilityOverrides : [],
    requireAllRequiredTasksSubmitted:
      src.requireAllRequiredTasksSubmitted === true
        ? true
        : src.requireAllRequiredTasksSubmitted === false
          ? false
          : undefined,
    allowPassingScoreWithPartialTaskSubmissions: Boolean(
      src.allowPassingScoreWithPartialTaskSubmissions
    ),
    minimumSubmittedTasksForPartialWaiver: Math.max(
      1,
      Number(src.minimumSubmittedTasksForPartialWaiver) || 1
    ),
  };
}

function isFixedComponentPolicy(policy = {}) {
  const rules = parseScoringRules(policy.scoringRules);
  return rules.model === SCORING_MODEL.FIXED_COMPONENTS_V1;
}

function normalizeQualificationPolicy(raw = {}) {
  const policy = scoring.normalizePolicy(raw);
  policy.scoringRules = parseScoringRules(raw.scoringRules || policy.scoringRules);
  return policy;
}

function pointsFromPercent(percent, maxPoints) {
  const pct = toNumber(percent);
  const max = toNumber(maxPoints, 0);
  if (pct == null || max <= 0) return null;
  return round2((clamp0to100(pct) / 100) * max);
}

function buildRequiredTaskRows({ tasks = [], submissions = [], studentId = null } = {}) {
  const assigned = (tasks || []).filter((task) => {
    if (!task) return false;
    if (task.is_required === false) return false;
    const assignees = task.assignee_ids || task.assigned_student_ids || task.assigned_to;
    if (Array.isArray(assignees) && assignees.length && studentId) {
      return assignees.map(String).includes(String(studentId));
    }
    return true;
  });
  const byTask = new Map();
  for (const sub of submissions || []) {
    const key = String(sub.task_id);
    const prev = byTask.get(key);
    if (!prev) {
      byTask.set(key, sub);
      continue;
    }
    const prevAccepted = ACCEPTED_TASK_STATUSES.includes(prev.review_status);
    const nextAccepted = ACCEPTED_TASK_STATUSES.includes(sub.review_status);
    if (nextAccepted && !prevAccepted) byTask.set(key, sub);
  }
  return assigned.map((task) => {
    const sub = byTask.get(String(task.id)) || null;
    return {
      taskId: task.id,
      title: task.title || '',
      gradingMode: task.grading_mode || task.gradingMode || null,
      reviewStatus: sub?.review_status || null,
      manualScore: sub?.manual_score ?? null,
      maxScore: sub?.max_score ?? null,
    };
  });
}

function resolveTaskPercent(row = {}) {
  const accepted = ACCEPTED_TASK_STATUSES.includes(String(row.reviewStatus || ''));
  if (!accepted) {
    return { percent: 0, source: 'MISSING_OR_NOT_ACCEPTED', accepted: false };
  }
  const score = toNumber(row.manualScore);
  const max = toNumber(row.maxScore);
  if (score != null && max != null && max > 0) {
    return { percent: round2(clamp0to100((score / max) * 100)), source: 'NUMERIC_GRADE', accepted: true };
  }
  return {
    percent: 100,
    source: 'APPROVED_WITHOUT_NUMERIC_GRADE',
    accepted: true,
  };
}

function computeTasksComponent(input = {}, policy = {}) {
  const rows = Array.isArray(input.requiredTaskRows)
    ? input.requiredTaskRows
    : [];
  const requiredCount = rows.length || toNumber(input.requiredTaskCount, 0) || 0;
  const details = rows.map((row) => {
    const resolved = resolveTaskPercent(row);
    return {
      taskId: row.taskId,
      title: row.title,
      rawScore: toNumber(row.manualScore),
      maxScore: toNumber(row.maxScore),
      reviewStatus: row.reviewStatus,
      normalizedPercent: resolved.percent,
      source: resolved.source,
      accepted: resolved.accepted,
    };
  });

  if (policy.scoringRules?.tasksScoringMode === TASKS_SCORING_MODE.GRADE_AVERAGE) {
    if (!requiredCount) {
      return {
        averagePercent: 100,
        points: pointsFromPercent(100, policy.tasksWeight),
        requiredCount: 0,
        acceptedCount: 0,
        completed: true,
        details,
      };
    }
    const sum = details.reduce((acc, row) => acc + (toNumber(row.normalizedPercent, 0) || 0), 0);
    const averagePercent = round2(sum / requiredCount);
    return {
      averagePercent,
      points: pointsFromPercent(averagePercent, policy.tasksWeight),
      requiredCount,
      acceptedCount: details.filter((row) => row.accepted).length,
      completed: details.every((row) => row.accepted),
      details,
    };
  }

  const acceptedCount = toNumber(input.acceptedTaskCount, details.filter((row) => row.accepted).length) || 0;
  const ratio =
    requiredCount > 0 ? round2((acceptedCount / requiredCount) * 100) : round2(input.taskCompletionPercent);
  return {
    averagePercent: ratio,
    points: ratio == null ? null : pointsFromPercent(ratio, policy.tasksWeight),
    requiredCount,
    acceptedCount,
    completed: requiredCount <= 0 || acceptedCount >= requiredCount,
    details,
  };
}

function formatAttendanceReason(actual, required) {
  if (actual != null && required != null) {
    return `نسبة الحضور ${round2(actual)}% وهي أقل من الحد الأدنى المطلوب ${required}%.`;
  }
  return `نسبة الحضور أقل من الحد الأدنى المطلوب ${required != null ? `${required}%` : ''}.`.trim();
}

function formatHoursReason(completed, required) {
  if (completed != null && required != null) {
    return `لم يستكمل الساعات التدريبية المطلوبة؛ أكمل ${round2(completed)} من أصل ${required} ساعة.`;
  }
  return `لم يستكمل الساعات التدريبية المطلوبة (${required != null ? `${required} ساعة` : ''}).`.trim();
}

function formatTasksReason(accepted, required) {
  return `لم يستكمل جميع التاسكات المطلوبة؛ أكمل ${accepted || 0} من أصل ${required}`;
}

function formatScoreReason(score, passing) {
  return `العلامة النهائية أقل من حد التأهيل؛ حصل على ${score}/100 · المطلوب ${passing}/100`;
}

function collectFixedGates({ input, policy, opportunity = {}, application = {}, tasksComponent, professional, finalScore }) {
  const reasons = [];
  const labelsAr = [];
  const staffIncomplete = [];
  const requirements = {
    expelled: false,
    failed: false,
    attendanceRequirementMet: true,
    hoursRequirementMet: true,
    preAssessmentCompleted: true,
    postAssessmentCompleted: true,
    requiredTasksCompleted: true,
    behaviorEvaluationComplete: true,
    scoreComplete: finalScore != null,
    scorePassed: finalScore != null && finalScore >= policy.minimumPassingScore,
  };

  const expelled = application.training_status === 'expelled' || Boolean(application.expelled_at);
  const failed = application.training_status === 'failed';
  if (expelled) {
    requirements.expelled = true;
    reasons.push(GATE_REASONS.EXPELLED);
    labelsAr.push(GATE_REASON_LABELS_AR.EXPELLED);
  }
  if (failed) {
    requirements.failed = true;
    reasons.push(GATE_REASONS.FAILED);
    labelsAr.push(GATE_REASON_LABELS_AR.FAILED);
  }

  const minAttendance = toNumber(
    opportunity.minimum_attendance_percentage,
    policy.minimumAttendancePercentage
  );
  const attendance = toNumber(input.attendancePercentage);
  if (minAttendance != null) {
    const ok = attendance != null && attendance >= minAttendance;
    requirements.attendanceRequirementMet = ok;
    if (!ok) {
      reasons.push(GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED);
      labelsAr.push(formatAttendanceReason(attendance, minAttendance));
    }
  }

  const requiredHours = toNumber(opportunity.required_training_hours, policy.requiredTrainingHours);
  const completedHours = toNumber(input.completedHours);
  if (requiredHours != null && requiredHours > 0) {
    const ok = completedHours != null && completedHours >= requiredHours;
    requirements.hoursRequirementMet = ok;
    if (!ok) {
      reasons.push(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED);
      labelsAr.push(formatHoursReason(completedHours, requiredHours));
    }
  }

  const preRequired =
    policy.scoringRules.preAssessmentRequired || opportunity.requires_pre_assessment === true;
  if (preRequired) {
    const preDone = toNumber(input.preAssessmentScore) != null;
    requirements.preAssessmentCompleted = preDone;
    if (!preDone) {
      reasons.push(GATE_REASONS.PRE_ASSESSMENT_NOT_COMPLETED);
      labelsAr.push(GATE_REASON_LABELS_AR.PRE_ASSESSMENT_NOT_COMPLETED);
    }
  }

  const postRequired = policy.postAssessmentRequired !== false && opportunity.requires_post_assessment !== false;
  if (postRequired) {
    const postDone = toNumber(input.postAssessmentScore) != null;
    requirements.postAssessmentCompleted = postDone;
    if (!postDone) {
      reasons.push(GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED);
      labelsAr.push(GATE_REASON_LABELS_AR.POST_ASSESSMENT_NOT_COMPLETED);
    }
  }

  const requireAllTasksExplicit = policy.scoringRules?.requireAllRequiredTasksSubmitted;
  if (requireAllTasksExplicit === false) {
    // Missing required tasks score as zero on the 40-point component; not a hard eligibility gate.
    requirements.requiredTasksCompleted = true;
    requirements.partialTasksWaiverApplied = !tasksComponent.completed;
  } else if (policy.requiredTasksRequired !== false) {
    const submittedCount = countSubmittedRequiredTasks(tasksComponent);
    const minSubmitted = policy.scoringRules?.minimumSubmittedTasksForPartialWaiver || 1;
    const partialWaiver =
      Boolean(policy.scoringRules?.allowPassingScoreWithPartialTaskSubmissions) &&
      finalScore != null &&
      finalScore >= policy.minimumPassingScore &&
      submittedCount >= minSubmitted;

    requirements.requiredTasksCompleted = Boolean(tasksComponent.completed) || partialWaiver;
    requirements.partialTasksWaiverApplied = Boolean(partialWaiver && !tasksComponent.completed);

    if (!tasksComponent.completed && !partialWaiver) {
      reasons.push(GATE_REASONS.REQUIRED_SUBMISSION_MISSING);
      labelsAr.push(formatTasksReason(tasksComponent.acceptedCount, tasksComponent.requiredCount));
    }
  }

  if (policy.professionalEvaluationRequired !== false) {
    const complete = professional.total != null && professional.percentage != null;
    requirements.behaviorEvaluationComplete = complete;
    if (!complete) {
      staffIncomplete.push(GATE_REASONS.PROFESSIONAL_EVALUATION_INCOMPLETE);
      reasons.push(GATE_REASONS.PROFESSIONAL_EVALUATION_INCOMPLETE);
      labelsAr.push(GATE_REASON_LABELS_AR.PROFESSIONAL_EVALUATION_INCOMPLETE);
    }
  }

  if (finalScore == null) {
    requirements.scoreComplete = false;
    requirements.scorePassed = false;
    if (!staffIncomplete.length) {
      reasons.push(GATE_REASONS.SCORE_INCOMPLETE);
      labelsAr.push(GATE_REASON_LABELS_AR.SCORE_INCOMPLETE);
    }
  } else if (
    policy.scoringRules?.scoreRequiredForEligibility &&
    finalScore < policy.minimumPassingScore
  ) {
    requirements.scorePassed = false;
    reasons.push(GATE_REASONS.FINAL_SCORE_BELOW_MINIMUM);
    labelsAr.push(formatScoreReason(finalScore, policy.minimumPassingScore));
  }

  return { reasons, labelsAr, requirements, staffIncomplete };
}

function countSubmittedRequiredTasks(tasksComponent = {}) {
  const details = Array.isArray(tasksComponent.details) ? tasksComponent.details : [];
  if (details.length) {
    return details.filter((row) => {
      const status = String(row.reviewStatus || '').trim().toLowerCase();
      if (!status || status === 'missing' || status === 'not_submitted') return false;
      return true;
    }).length;
  }
  return toNumber(tasksComponent.submittedCount, 0) || 0;
}

function isZeroParticipationCandidate({ policy, input, tasksComponent, skip = false }) {
  if (skip) return false;
  const zp = policy.scoringRules?.zeroParticipationPolicy;
  if (!zp || zp.enabled === false) return false;
  const preDone = toNumber(input.preAssessmentScore) != null;
  const submitted = countSubmittedRequiredTasks(tasksComponent);
  const missingPre = zp.requireMissingPreAssessment !== false ? !preDone : true;
  const zeroTasks = zp.requireZeroSubmittedRequiredTasks !== false ? submitted === 0 : true;
  return Boolean(missingPre && zeroTasks);
}

function resolveEligibilityStatus({
  expelled,
  failed,
  requirements,
  reasons,
  staffIncomplete,
  opportunity = {},
  forcedNotEligible = false,
}) {
  if (expelled || failed || forcedNotEligible) return 'NOT_ELIGIBLE';
  const studentFailCodes = new Set([
    GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED,
    GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED,
    GATE_REASONS.PRE_ASSESSMENT_NOT_COMPLETED,
    GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED,
    GATE_REASONS.REQUIRED_SUBMISSION_MISSING,
    GATE_REASONS.FINAL_SCORE_BELOW_MINIMUM,
    GATE_REASONS.EXPELLED,
    GATE_REASONS.FAILED,
    GATE_REASONS.ZERO_PARTICIPATION,
    GATE_REASONS.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION,
  ]);
  const hasStudentFail = reasons.some((code) => studentFailCodes.has(code));
  if (hasStudentFail) return 'NOT_ELIGIBLE';
  if (staffIncomplete.length) {
    const active = !['archived'].includes(String(opportunity.status || ''));
    return active ? 'NEEDS_REVIEW' : 'NOT_ELIGIBLE';
  }
  if (!requirements.scoreComplete) return 'NEEDS_REVIEW';
  return 'ELIGIBLE';
}

function mapStatusToWorkflow(eligibilityStatus) {
  if (eligibilityStatus === 'ELIGIBLE') return 'eligible';
  if (eligibilityStatus === 'NEEDS_REVIEW') return 'needs_review';
  return 'ineligible';
}

function calculateFixedComponentQualification(rawInput = {}, rawPolicy = {}, context = {}) {
  const policy = normalizeQualificationPolicy(rawPolicy);
  const input = rawInput || {};
  const application = context.application || {};
  const opportunity = context.opportunity || {};
  const student = context.student || {};

  const override = resolveEligibilityOverride({ policy, student, application });
  const skipZeroParticipation = Boolean(override?.skipZeroParticipation);

  const derived = scoring.criterionFromEvidence(input, policy);
  const professional = scoring.professionalTotals(derived.criteria, {
    required: policy.professionalEvaluationRequired,
  });
  const tasksComponent = computeTasksComponent(input, policy);
  const submittedRequiredTaskCount = countSubmittedRequiredTasks({
    ...tasksComponent,
    submittedCount: input.submittedTaskCount,
  });
  tasksComponent.submittedCount = submittedRequiredTaskCount;

  const rawAttendancePct = clamp0to100(input.attendancePercentage);
  const rawPostPct = clamp0to100(input.postAssessmentScore);
  const rawAttendancePoints = pointsFromPercent(rawAttendancePct, policy.attendanceWeight);
  const rawPostPoints = pointsFromPercent(rawPostPct, policy.postAssessmentWeight);
  const rawTasksPoints = tasksComponent.points;
  const rawBehaviorPct = professional.percentage;
  const rawBehaviorPoints = pointsFromPercent(rawBehaviorPct, policy.professionalEvaluationWeight);

  const rawComplete =
    rawAttendancePoints != null &&
    rawPostPoints != null &&
    rawTasksPoints != null &&
    rawBehaviorPoints != null;
  const rawFinalScore = rawComplete
    ? round1(rawAttendancePoints + rawPostPoints + rawTasksPoints + rawBehaviorPoints)
    : null;

  const zeroParticipationApplied = isZeroParticipationCandidate({
    policy,
    input,
    tasksComponent,
    skip: skipZeroParticipation,
  });

  let attendancePct = rawAttendancePct;
  let postPct = rawPostPct;
  let attendancePoints = rawAttendancePoints;
  let postPoints = rawPostPoints;
  let tasksPoints = rawTasksPoints;
  let behaviorPct = rawBehaviorPct;
  let behaviorPoints = rawBehaviorPoints;
  let tasksAveragePercent = tasksComponent.averagePercent;
  let finalScore = rawFinalScore;
  let complete = rawComplete;
  let professionalTotalEffective = professional.total;
  let professionalPercentageEffective = professional.percentage;

  if (zeroParticipationApplied) {
    attendancePct = 0;
    attendancePoints = 0;
    postPct = rawPostPct == null ? 0 : 0;
    postPoints = 0;
    tasksAveragePercent = 0;
    tasksPoints = 0;
    behaviorPct = 0;
    behaviorPoints = 0;
    professionalTotalEffective = 0;
    professionalPercentageEffective = 0;
    finalScore = 0;
    complete = true;
  }

  const scorePassed = finalScore != null && finalScore >= policy.minimumPassingScore;

  const gates = collectFixedGates({
    input,
    policy,
    opportunity,
    application,
    tasksComponent: zeroParticipationApplied
      ? { ...tasksComponent, averagePercent: 0, points: 0, completed: false }
      : tasksComponent,
    professional,
    finalScore,
  });

  let reasons = [...gates.reasons];
  let labelsAr = [...gates.labelsAr];
  let forcedNotEligible = false;
  let eligibilityOverrideMeta = null;

  // Priority: expelled/failed already in gates → then authorized override → then zero participation.
  if (override?.type === ELIGIBILITY_OVERRIDE_TYPE.FORCE_NOT_ELIGIBLE) {
    forcedNotEligible = true;
    eligibilityOverrideMeta = {
      ...override,
      eligibilityOverride: 'FORCE_NOT_ELIGIBLE',
    };
    if (!reasons.includes(override.reasonCode)) {
      reasons = [override.reasonCode, ...reasons];
    }
    if (!labelsAr.includes(override.reasonAr)) {
      labelsAr = [override.reasonAr, ...labelsAr];
    }
  } else if (zeroParticipationApplied) {
    forcedNotEligible = true;
    reasons = [
      GATE_REASONS.ZERO_PARTICIPATION,
      GATE_REASONS.PRE_ASSESSMENT_NOT_COMPLETED,
      GATE_REASONS.REQUIRED_SUBMISSION_MISSING,
    ];
    labelsAr = [...ZERO_PARTICIPATION_LABELS_AR];
    gates.requirements.preAssessmentCompleted = false;
    gates.requirements.requiredTasksCompleted = false;
    gates.requirements.attendanceRequirementMet = false;
    gates.requirements.scorePassed = false;
    gates.requirements.scoreComplete = true;
  }

  const eligibilityStatus = resolveEligibilityStatus({
    expelled: gates.requirements.expelled,
    failed: gates.requirements.failed,
    requirements: gates.requirements,
    reasons,
    staffIncomplete: zeroParticipationApplied ? [] : gates.staffIncomplete,
    opportunity,
    forcedNotEligible,
  });

  let finalStatus = FINAL_STATUS.NOT_ELIGIBLE;
  if (finalScore == null) finalStatus = 'INCOMPLETE';
  else if (eligibilityStatus === 'ELIGIBLE' && scorePassed) finalStatus = FINAL_STATUS.PASSED;
  else if (finalScore != null && !scorePassed) finalStatus = FINAL_STATUS.FAILED;
  else finalStatus = FINAL_STATUS.NOT_ELIGIBLE;

  const scoreComponents = {
    attendance: {
      rawPercentage: rawAttendancePct,
      effectivePercentage: attendancePct,
      points: attendancePoints,
      maxPoints: policy.attendanceWeight,
      evaluationAttendancePercentage: attendancePct,
      recordedAttendancePercentage: rawAttendancePct,
    },
    postAssessment: {
      rawPercentage: rawPostPct,
      effectivePercentage: postPct,
      points: postPoints,
      maxPoints: policy.postAssessmentWeight,
    },
    tasks: {
      rawPercentage: tasksComponent.averagePercent,
      effectivePercentage: tasksAveragePercent,
      points: tasksPoints,
      maxPoints: policy.tasksWeight,
      details: tasksComponent.details,
      acceptedCount: tasksComponent.acceptedCount,
      requiredCount: tasksComponent.requiredCount,
      submittedCount: submittedRequiredTaskCount,
    },
    behavior: {
      rawPercentage: rawBehaviorPct,
      effectivePercentage: behaviorPct,
      points: behaviorPoints,
      maxPoints: policy.professionalEvaluationWeight,
      professionalTotal: zeroParticipationApplied ? 0 : professional.total,
      professionalMax: 50,
      rawProfessionalTotal: professional.total,
    },
    finalScore,
    rawFinalScore,
  };

  return {
    policyValid: scoring.validatePolicyWeights(policy).ok,
    policyWeightTotal: scoring.validatePolicyWeights(policy).total,
    policy,
    eligibilityStatus,
    finalStatus,
    scoreStatus: complete ? 'COMPLETE' : 'INCOMPLETE',
    scorePassed,
    finalScore,
    finalPercentage: finalScore,
    eligibilityReasons: reasons,
    eligibilityReasonLabels: labelsAr,
    mandatoryRequirements: gates.requirements,
    scoreComponents,
    attendanceComponentScore: attendancePoints,
    tasksComponentScore: tasksPoints,
    postAssessmentComponentScore: postPoints,
    professionalComponentScore: behaviorPoints,
    attendancePercent: attendancePct,
    recordedAttendancePercent: rawAttendancePct,
    postAssessmentPercent: postPct,
    tasksAveragePercent,
    preAssessmentScore: round1(input.preAssessmentScore),
    postAssessmentScore: round1(input.postAssessmentScore),
    improvementPercentage:
      toNumber(input.preAssessmentScore) != null && toNumber(input.postAssessmentScore) != null
        ? round1(toNumber(input.postAssessmentScore) - toNumber(input.preAssessmentScore))
        : null,
    criterion1Score: derived.criteria.criterion1,
    criterion2Score: derived.criteria.criterion2,
    criterion3Score: derived.criteria.criterion3,
    criterion4Score: derived.criteria.criterion4,
    criterion5Score: derived.criteria.criterion5,
    criterion6Score: derived.criteria.criterion6,
    criterion7Score: derived.criteria.criterion7,
    criterion8Score: derived.criteria.criterion8,
    criterion9Score: derived.criteria.criterion9,
    criterion10Score: derived.criteria.criterion10,
    criterionEvidence: derived.criterionEvidence,
    performanceSnapshot: derived.performanceSnapshot,
    professionalTotal: professionalTotalEffective,
    professionalPercentage: professionalPercentageEffective,
    ratingsComplete: scoring.supervisorRatingsComplete(input.supervisorRatings),
    usesManualRating: scoring.usesManualRating(derived.criterionEvidence),
    workflowOutcome: mapStatusToWorkflow(eligibilityStatus),
    zeroParticipationApplied,
    zeroParticipationPolicyCode: zeroParticipationApplied
      ? policy.scoringRules?.zeroParticipationPolicy?.code || ZERO_PARTICIPATION_POLICY_V1.code
      : null,
    eligibilityOverride: eligibilityOverrideMeta,
    submittedRequiredTaskCount,
    application: context.application,
  };
}

/**
 * LEGACY_WEIGHTED live engine. Not an official result path by itself.
 * Routed only when `resolveFieldTrainingPolicy` selects LEGACY_WEIGHTED_V1.
 * Do not call from reports, Excel, or completion-letter code.
 */
function wrapLegacyEvaluation(rawInput, rawPolicy, context = {}) {
  const policy = normalizeQualificationPolicy(rawPolicy);
  const calculated = scoring.calculateFinalEvaluation(rawInput, policy);
  const eligibilityStatus = calculated.eligibilityStatus || 'NOT_ELIGIBLE';
  return {
    ...calculated,
    policy,
    scoreStatus: calculated.finalScore != null ? 'COMPLETE' : 'INCOMPLETE',
    scorePassed:
      calculated.finalScore != null && calculated.finalScore >= (policy.minimumPassingScore || 60),
    scoreComponents: {
      attendance: {
        rawPercentage: calculated.attendanceComponentScore,
        points: calculated.attendanceComponentScore,
        maxPoints: 100,
      },
      postAssessment: {
        rawPercentage: calculated.postAssessmentComponentScore,
        points: calculated.postAssessmentComponentScore,
        maxPoints: 100,
      },
      tasks: {
        rawPercentage: calculated.tasksComponentScore,
        points: calculated.tasksComponentScore,
        maxPoints: 100,
      },
      behavior: {
        rawPercentage: calculated.professionalComponentScore,
        points: calculated.professionalComponentScore,
        maxPoints: 100,
        professionalTotal: calculated.professionalTotal,
        professionalMax: 50,
      },
      finalScore: calculated.finalScore,
    },
    mandatoryRequirements: {
      attendanceRequirementMet: !(calculated.eligibilityReasons || []).includes(
        GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED
      ),
      hoursRequirementMet: !(calculated.eligibilityReasons || []).includes(
        GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED
      ),
      preAssessmentCompleted: true,
      postAssessmentCompleted: !(calculated.eligibilityReasons || []).includes(
        GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED
      ),
      requiredTasksCompleted: !(calculated.eligibilityReasons || []).includes(
        GATE_REASONS.REQUIRED_SUBMISSION_MISSING
      ),
      behaviorEvaluationComplete: true,
      scoreComplete: calculated.finalScore != null,
      scorePassed:
        calculated.finalScore != null && calculated.finalScore >= (policy.minimumPassingScore || 60),
    },
    eligibilityReasonLabels: (calculated.eligibilityReasons || []).map(
      (code) => GATE_REASON_LABELS_AR[code] || code
    ),
    workflowOutcome: mapStatusToWorkflow(eligibilityStatus),
    application: context.application,
  };
}

/**
 * Live Field Training qualification engines.
 * Policy family is selected by `resolveFieldTrainingPolicy` before this runs.
 * Official UI/report/Excel must consume `resolveFieldTrainingApprovedResult`, not this function.
 */
function calculateFieldTrainingFinalQualification(rawInput = {}, rawPolicy = {}, context = {}) {
  const policy = normalizeQualificationPolicy(rawPolicy);
  if (isFixedComponentPolicy(policy)) {
    return calculateFixedComponentQualification(rawInput, policy, context);
  }
  return wrapLegacyEvaluation(rawInput, policy, context);
}

function qualifyLoadedContext(ctx) {
  if (!ctx) return null;
  const policyMod = require('./fieldTraining.policy.service');
  const resolved = policyMod.resolveFieldTrainingPolicy({
    application: ctx.application,
    opportunity: ctx.opportunity,
    universityPolicy: ctx.policy,
    student: ctx.student,
  });
  const policy = policyMod.materializeQualificationPolicy({ ...ctx.policy }, resolved);
  ctx.resolvedPolicy = resolved;
  if (policy.requiredTrainingHours == null) {
    policy.requiredTrainingHours =
      ctx.scoringInput?.requiredHours ?? ctx.opportunity?.required_training_hours;
  }
  const scoringInput = {
    ...ctx.scoringInput,
    completedHours:
      toNumber(ctx.application?.completed_training_hours) != null
        ? toNumber(ctx.application.completed_training_hours)
        : ctx.scoringInput?.completedHours,
    requiredTaskRows:
      ctx.scoringInput?.requiredTaskRows ||
      buildRequiredTaskRows({
        tasks: ctx.tasks,
        submissions: ctx.submissions,
        studentId: ctx.application?.student_id,
      }),
  };
  const calculated = calculateFieldTrainingFinalQualification(scoringInput, policy, {
    application: ctx.application,
    opportunity: ctx.opportunity,
    student: ctx.student,
  });
  if (calculated) calculated.resolvedPolicy = resolved;
  return calculated;
}

module.exports = {
  toNumber,
  round1,
  round2,
  parseScoringRules,
  isFixedComponentPolicy,
  normalizeQualificationPolicy,
  buildRequiredTaskRows,
  resolveTaskPercent,
  computeTasksComponent,
  pointsFromPercent,
  countSubmittedRequiredTasks,
  isZeroParticipationCandidate,
  calculateFieldTrainingFinalQualification,
  qualifyLoadedContext,
  mapStatusToWorkflow,
};
