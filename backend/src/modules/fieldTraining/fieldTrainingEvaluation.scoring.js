'use strict';

const { DEFAULT_POLICY, FINAL_STATUS, GATE_REASONS, SUPERVISOR_RATING_FIELDS } = require('./fieldTrainingEvaluation.constants');

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

function clampScore15(value) {
  const n = toNumber(value);
  if (n == null) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function average(values) {
  const nums = (values || []).map((v) => toNumber(v)).filter((v) => v != null);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function mapPercentToFive(pct) {
  const n = toNumber(pct);
  if (n == null) return null;
  if (n >= 90) return 5;
  if (n >= 80) return 4;
  if (n >= 70) return 3;
  if (n >= 60) return 2;
  return 1;
}

function mapAttendanceBand(percentage, bands = DEFAULT_POLICY.attendanceBands) {
  const n = toNumber(percentage);
  if (n == null) return null;
  const list = Array.isArray(bands) && bands.length ? bands : DEFAULT_POLICY.attendanceBands;
  for (const band of list) {
    const min = toNumber(band.min, 0);
    const max = toNumber(band.max, 100);
    if (n >= min && n <= max) return clampScore15(band.score);
  }
  return clampScore15(list[list.length - 1]?.score);
}

function normalizePolicy(raw = {}) {
  const attendanceWeight = toNumber(raw.attendanceWeight, DEFAULT_POLICY.attendanceWeight);
  const tasksWeight = toNumber(raw.tasksWeight, DEFAULT_POLICY.tasksWeight);
  const postAssessmentWeight = toNumber(raw.postAssessmentWeight, DEFAULT_POLICY.postAssessmentWeight);
  const professionalEvaluationWeight = toNumber(
    raw.professionalEvaluationWeight,
    DEFAULT_POLICY.professionalEvaluationWeight
  );
  return {
    minimumAttendancePercentage: toNumber(
      raw.minimumAttendancePercentage,
      DEFAULT_POLICY.minimumAttendancePercentage
    ),
    requiredTrainingHours:
      raw.requiredTrainingHours == null ? DEFAULT_POLICY.requiredTrainingHours : toNumber(raw.requiredTrainingHours),
    requiredTasksRequired: raw.requiredTasksRequired !== false,
    postAssessmentRequired: raw.postAssessmentRequired !== false,
    professionalEvaluationRequired: raw.professionalEvaluationRequired !== false,
    minimumPassingScore: toNumber(raw.minimumPassingScore, DEFAULT_POLICY.minimumPassingScore),
    attendanceWeight,
    tasksWeight,
    postAssessmentWeight,
    professionalEvaluationWeight,
    attendanceBands: Array.isArray(raw.attendanceBands) && raw.attendanceBands.length
      ? raw.attendanceBands
      : DEFAULT_POLICY.attendanceBands,
  };
}

function validatePolicyWeights(policy) {
  const p = normalizePolicy(policy);
  const enabled = [];
  if (p.attendanceWeight > 0) enabled.push(p.attendanceWeight);
  if (p.tasksWeight > 0) enabled.push(p.tasksWeight);
  if (p.postAssessmentWeight > 0) enabled.push(p.postAssessmentWeight);
  if (p.professionalEvaluationWeight > 0) enabled.push(p.professionalEvaluationWeight);
  const total = enabled.reduce((sum, n) => sum + n, 0);
  const ok = Math.abs(total - 100) < 0.01;
  return { ok, total: round1(total), policy: p };
}

function supervisorRatingsComplete(ratings) {
  if (!ratings || typeof ratings !== 'object') return false;
  return SUPERVISOR_RATING_FIELDS.every((field) => clampScore15(ratings[field]) != null);
}

function averageSupervisorRatings(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const aggregated = {};
  for (const field of SUPERVISOR_RATING_FIELDS) {
    const avg = average(rows.map((row) => row[field]));
    aggregated[field] = clampScore15(avg);
  }
  return supervisorRatingsComplete(aggregated) ? aggregated : aggregated;
}

function evaluateGates(input, policy) {
  const reasons = [];
  const requiredHours = toNumber(policy.requiredTrainingHours, toNumber(input.requiredHours));
  const completedHours = toNumber(input.completedHours, 0);
  if (requiredHours != null && requiredHours > 0 && completedHours < requiredHours) {
    reasons.push(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED);
  }

  const attendance = toNumber(input.attendancePercentage);
  if (
    policy.minimumAttendancePercentage != null &&
    (attendance == null || attendance < policy.minimumAttendancePercentage)
  ) {
    reasons.push(GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED);
  }

  const requiredTasks = toNumber(input.requiredTaskCount, 0);
  const acceptedTasks = toNumber(input.acceptedTaskCount, 0);
  if (policy.requiredTasksRequired && requiredTasks > 0 && acceptedTasks < requiredTasks) {
    reasons.push(GATE_REASONS.REQUIRED_SUBMISSION_MISSING);
  }

  if (policy.postAssessmentRequired && toNumber(input.postAssessmentScore) == null) {
    reasons.push(GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED);
  }

  const ratingsComplete = supervisorRatingsComplete(input.supervisorRatings);
  if (policy.professionalEvaluationRequired && !ratingsComplete) {
    reasons.push(GATE_REASONS.PROFESSIONAL_EVALUATION_INCOMPLETE);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    ratingsComplete,
  };
}

function criterionFromEvidence(input, policy) {
  const ratings = input.supervisorRatings || {};
  const taskPct =
    toNumber(input.requiredTaskCount, 0) > 0
      ? (toNumber(input.acceptedTaskCount, 0) / input.requiredTaskCount) * 100
      : toNumber(input.taskCompletionPercent);
  const taskScore = mapPercentToFive(taskPct);
  const postMapped = mapPercentToFive(input.postAssessmentScore);
  const efficiency = clampScore15(average([taskScore, postMapped, mapPercentToFive(input.taskScoreAveragePercent)]));

  let accuracy = mapPercentToFive(input.taskScoreAveragePercent);
  if (accuracy == null) accuracy = taskScore;
  const rejected = toNumber(input.rejectedTaskCount, 0);
  if (accuracy != null && rejected > 0) {
    accuracy = clampScore15(Math.max(1, accuracy - Math.min(2, rejected)));
  }

  return {
    criterion1: efficiency,
    criterion2: accuracy,
    criterion3: clampScore15(ratings.thinkingAndInitiative),
    criterion4: clampScore15(ratings.problemSolving),
    criterion5: mapAttendanceBand(input.attendancePercentage, policy.attendanceBands),
    criterion6: clampScore15(ratings.teamwork),
    criterion7: clampScore15(ratings.professionalConduct),
    criterion8: clampScore15(ratings.supervisorCooperation),
    criterion9: taskScore,
    criterion10: clampScore15(ratings.rulesCompliance),
  };
}

function professionalTotals(criteria, { required, ratingsComplete }) {
  const scores = [
    criteria.criterion1,
    criteria.criterion2,
    criteria.criterion3,
    criteria.criterion4,
    criteria.criterion5,
    criteria.criterion6,
    criteria.criterion7,
    criteria.criterion8,
    criteria.criterion9,
    criteria.criterion10,
  ];
  if (required && !ratingsComplete) {
    return { total: null, percentage: null, scores };
  }
  const available = scores.filter((s) => s != null);
  if (!available.length) return { total: null, percentage: null, scores };
  if (required && available.length < 10) {
    return { total: null, percentage: null, scores };
  }
  const total = available.reduce((sum, n) => sum + n, 0);
  const max = required ? 50 : available.length * 5;
  return {
    total,
    percentage: round1((total / max) * 100),
    scores,
  };
}

function weightedFinalScore({ attendance, tasks, post, professional }, policy) {
  const parts = [
    { score: attendance, weight: policy.attendanceWeight },
    { score: tasks, weight: policy.tasksWeight },
    { score: post, weight: policy.postAssessmentWeight },
    { score: professional, weight: policy.professionalEvaluationWeight },
  ].filter((part) => part.weight > 0 && part.score != null);

  if (!parts.length) return null;
  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  if (weightSum <= 0) return null;
  const raw = parts.reduce((sum, part) => sum + (part.score * part.weight) / weightSum, 0);
  return round1(raw);
}

/**
 * Pure scoring. Eligibility is independent of PASSED/FAILED.
 */
function calculateFinalEvaluation(rawInput = {}, rawPolicy = {}) {
  const policyCheck = validatePolicyWeights(rawPolicy);
  const policy = policyCheck.policy;
  const input = rawInput || {};
  const gates = evaluateGates(input, policy);
  const criteria = criterionFromEvidence(input, policy);
  const professional = professionalTotals(criteria, {
    required: policy.professionalEvaluationRequired,
    ratingsComplete: gates.ratingsComplete,
  });

  const attendanceComponent = round1(input.attendancePercentage);
  const tasksComponent =
    toNumber(input.requiredTaskCount, 0) > 0
      ? round1((toNumber(input.acceptedTaskCount, 0) / input.requiredTaskCount) * 100)
      : round1(input.taskCompletionPercent);
  const postComponent = round1(input.postAssessmentScore);
  const professionalComponent = professional.percentage;

  let finalStatus = FINAL_STATUS.NOT_ELIGIBLE;
  let finalScore = null;
  if (gates.eligible) {
    finalScore = weightedFinalScore(
      {
        attendance: attendanceComponent,
        tasks: tasksComponent,
        post: postComponent,
        professional: professionalComponent,
      },
      policy
    );
    const passing = toNumber(policy.minimumPassingScore, 60);
    finalStatus =
      finalScore != null && finalScore >= passing ? FINAL_STATUS.PASSED : FINAL_STATUS.FAILED;
  }

  const pre = round1(input.preAssessmentScore);
  const post = round1(input.postAssessmentScore);
  const improvement = pre != null && post != null ? round1(post - pre) : null;

  return {
    policyValid: policyCheck.ok,
    policyWeightTotal: policyCheck.total,
    eligibilityStatus: gates.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
    finalStatus,
    eligibilityReasons: gates.reasons,
    attendanceComponentScore: attendanceComponent,
    tasksComponentScore: tasksComponent,
    postAssessmentComponentScore: postComponent,
    professionalComponentScore: professionalComponent,
    preAssessmentScore: pre,
    postAssessmentScore: post,
    improvementPercentage: improvement,
    criterion1Score: criteria.criterion1,
    criterion2Score: criteria.criterion2,
    criterion3Score: criteria.criterion3,
    criterion4Score: criteria.criterion4,
    criterion5Score: criteria.criterion5,
    criterion6Score: criteria.criterion6,
    criterion7Score: criteria.criterion7,
    criterion8Score: criteria.criterion8,
    criterion9Score: criteria.criterion9,
    criterion10Score: criteria.criterion10,
    professionalTotal: professional.total,
    professionalPercentage: professional.percentage,
    finalScore,
    finalPercentage: finalScore,
    ratingsComplete: gates.ratingsComplete,
    policy,
  };
}

module.exports = {
  toNumber,
  round1,
  clampScore15,
  average,
  mapPercentToFive,
  mapAttendanceBand,
  normalizePolicy,
  validatePolicyWeights,
  supervisorRatingsComplete,
  averageSupervisorRatings,
  evaluateGates,
  criterionFromEvidence,
  calculateFinalEvaluation,
};
