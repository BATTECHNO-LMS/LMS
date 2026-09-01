'use strict';

const {
  DEFAULT_POLICY,
  FINAL_STATUS,
  GATE_REASONS,
  SUPERVISOR_RATING_FIELDS,
  DEFAULT_FIVE_POINT_THRESHOLDS,
  SCORE_SOURCE,
  PROFESSIONAL_CRITERION_EVIDENCE_CODES,
} = require('./fieldTrainingEvaluation.constants');
const { buildFieldTrainingStudentPerformanceSnapshot } = require('./fieldTrainingEvaluation.performanceSnapshot');

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

function resolveFivePointThresholds(policy = {}) {
  const configured = policy.fivePointThresholds;
  if (Array.isArray(configured) && configured.length) return configured;
  return DEFAULT_FIVE_POINT_THRESHOLDS;
}

/**
 * Central 0–100 → 1–5 mapper. Thresholds are university-configurable.
 */
function score100ToFivePoint(pct, policy = {}) {
  const n = toNumber(pct);
  if (n == null) return null;
  const thresholds = resolveFivePointThresholds(policy);
  for (const band of thresholds) {
    const min = toNumber(band.min, 0);
    const max = toNumber(band.max, 100);
    if (n >= min && n <= max) return clampScore15(band.score);
  }
  return clampScore15(thresholds[thresholds.length - 1]?.score);
}

function mapPercentToFive(pct, policy = {}) {
  return score100ToFivePoint(pct, policy);
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

/**
 * Renormalize weighted components when optional metrics are unavailable.
 * Never treats missing components as zero.
 */
function renormalizeWeightedAverage(components = []) {
  const available = (components || []).filter(
    (part) => part && part.weight > 0 && toNumber(part.value) != null
  );
  if (!available.length) return null;
  const weightSum = available.reduce((sum, part) => sum + part.weight, 0);
  if (weightSum <= 0) return null;
  const raw = available.reduce(
    (sum, part) => sum + (toNumber(part.value) * part.weight) / weightSum,
    0
  );
  return round1(raw);
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
    fivePointThresholds: Array.isArray(raw.fivePointThresholds) && raw.fivePointThresholds.length
      ? raw.fivePointThresholds
      : DEFAULT_FIVE_POINT_THRESHOLDS,
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
  return aggregated;
}

function buildCriterionResult({ score, source, evidence = {}, calculatedMetric = null, missingEvidence = null }) {
  return {
    score: clampScore15(score),
    source: source || null,
    evidence,
    calculatedMetric: calculatedMetric == null ? null : round1(calculatedMetric),
    missingEvidence,
  };
}

function directSupervisorCriterion(ratings, field, evidenceKey, bulkAuthorizedFields = null) {
  const value = clampScore15(ratings?.[field]);
  if (value == null) return null;
  const isBulk =
    bulkAuthorizedFields &&
    (bulkAuthorizedFields.has?.(field) ||
      (Array.isArray(bulkAuthorizedFields) && bulkAuthorizedFields.includes(field)));
  return buildCriterionResult({
    score: value,
    source: isBulk ? SCORE_SOURCE.MANUAL_AUTHORIZED_BULK_RATING : SCORE_SOURCE.DIRECT_SUPERVISOR_RATING,
    evidence: { [evidenceKey]: value },
  });
}

function derivedCriterion(metric100, policy, evidence, weightsUsed) {
  if (metric100 == null) return null;
  return buildCriterionResult({
    score: score100ToFivePoint(metric100, policy),
    source: SCORE_SOURCE.DERIVED_FROM_PERFORMANCE,
    evidence: { ...evidence, weightsUsed },
    calculatedMetric: metric100,
  });
}

function criterionFromEvidence(rawInput, policy) {
  const snapshot = buildFieldTrainingStudentPerformanceSnapshot(rawInput, policy);
  const metrics = snapshot.metrics;
  const ratings = snapshot.supervisorRatings || {};
  const bulkFields = rawInput.bulkAuthorizedSupervisorFields || null;
  const results = {};

  const efficiencyMetric = renormalizeWeightedAverage([
    { value: metrics.tasksCompletionMetric, weight: 40 },
    { value: metrics.taskQualityMetric, weight: 40 },
    { value: metrics.postAssessmentMetric, weight: 20 },
  ]);
  results.criterion1 =
    derivedCriterion(efficiencyMetric, policy, {
      taskCompletionPercentage: metrics.tasksCompletionMetric,
      averageTaskScore: metrics.taskQualityMetric,
      postAssessmentScore: snapshot.postAssessmentRaw,
    }, { taskCompletion: 40, taskQuality: 40, postAssessment: 20 }) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {
        taskCompletionPercentage: metrics.tasksCompletionMetric,
        averageTaskScore: metrics.taskQualityMetric,
        postAssessmentScore: snapshot.postAssessmentRaw,
      },
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_1,
    });

  let accuracyMetric = renormalizeWeightedAverage([
    { value: metrics.taskQualityMetric, weight: 70 },
    { value: metrics.tasksCompletionMetric, weight: 30 },
  ]);
  if (accuracyMetric != null && toNumber(snapshot.rejectedTasks, 0) > 0) {
    const rejected = toNumber(snapshot.rejectedTasks, 0);
    accuracyMetric = Math.max(0, accuracyMetric - Math.min(20, rejected * 5));
  }
  results.criterion2 =
    derivedCriterion(accuracyMetric, policy, {
      averageTaskScore: metrics.taskQualityMetric,
      taskCompletionPercentage: metrics.tasksCompletionMetric,
      rejectedTaskCount: snapshot.rejectedTasks,
    }, { taskQuality: 70, taskCompletion: 30 }) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {
        averageTaskScore: metrics.taskQualityMetric,
        rejectedTaskCount: snapshot.rejectedTasks,
      },
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_2,
    });

  results.criterion3 =
    directSupervisorCriterion(ratings, 'thinkingAndInitiative', 'thinkingAndInitiative', bulkFields) ||
    (() => {
      const thinkingMetric = renormalizeWeightedAverage([
        { value: metrics.postAssessmentMetric, weight: 50 },
        { value: metrics.taskQualityMetric, weight: 30 },
        { value: metrics.assessmentImprovementMetric, weight: 20 },
      ]);
      if (thinkingMetric == null) {
        return buildCriterionResult({
          score: null,
          source: null,
          evidence: {
            postAssessmentScore: snapshot.postAssessmentRaw,
            averageTaskScore: metrics.taskQualityMetric,
            assessmentImprovement: snapshot.assessmentImprovement,
          },
          missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_3,
        });
      }
      return derivedCriterion(thinkingMetric, policy, {
        postAssessmentScore: snapshot.postAssessmentRaw,
        averageTaskScore: metrics.taskQualityMetric,
        assessmentImprovement: snapshot.assessmentImprovement,
      }, { postAssessment: 50, taskQuality: 30, improvement: 20 });
    })();

  results.criterion4 =
    directSupervisorCriterion(ratings, 'problemSolving', 'problemSolving', bulkFields) ||
    (() => {
      const problemMetric = renormalizeWeightedAverage([
        { value: metrics.taskQualityMetric, weight: 50 },
        { value: metrics.postAssessmentMetric, weight: 30 },
        { value: metrics.tasksCompletionMetric, weight: 20 },
      ]);
      if (problemMetric == null) {
        return buildCriterionResult({
          score: null,
          source: null,
          evidence: {
            averageTaskScore: metrics.taskQualityMetric,
            postAssessmentScore: snapshot.postAssessmentRaw,
            taskCompletionPercentage: metrics.tasksCompletionMetric,
          },
          missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_4,
        });
      }
      return derivedCriterion(problemMetric, policy, {
        averageTaskScore: metrics.taskQualityMetric,
        postAssessmentScore: snapshot.postAssessmentRaw,
        taskCompletionPercentage: metrics.tasksCompletionMetric,
      }, { taskQuality: 50, postAssessment: 30, taskCompletion: 20 });
    })();

  const attendanceMetric = renormalizeWeightedAverage([
    { value: metrics.attendanceMetric, weight: 70 },
    { value: metrics.hoursMetric, weight: 30 },
  ]);
  results.criterion5 =
    (attendanceMetric != null
      ? derivedCriterion(attendanceMetric, policy, {
          attendancePercentage: snapshot.attendancePercentage,
          completedTrainingHours: snapshot.completedTrainingHours,
          requiredTrainingHours: snapshot.requiredTrainingHours,
          absenceDays: snapshot.absenceDays,
          lateDays: snapshot.lateDays,
        }, { attendance: 70, hours: 30 })
      : mapAttendanceBand(snapshot.attendancePercentage, policy.attendanceBands) != null
        ? buildCriterionResult({
            score: mapAttendanceBand(snapshot.attendancePercentage, policy.attendanceBands),
            source: SCORE_SOURCE.DERIVED_FROM_PERFORMANCE,
            evidence: { attendancePercentage: snapshot.attendancePercentage },
            calculatedMetric: snapshot.attendancePercentage,
          })
        : buildCriterionResult({
            score: null,
            source: null,
            evidence: {
              attendancePercentage: snapshot.attendancePercentage,
              completedTrainingHours: snapshot.completedTrainingHours,
            },
            missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_5,
          }));

  results.criterion6 =
    directSupervisorCriterion(ratings, 'teamwork', 'teamwork', bulkFields) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {},
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_6,
    });

  results.criterion7 =
    directSupervisorCriterion(ratings, 'professionalConduct', 'professionalConduct', bulkFields) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {},
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_7,
    });

  results.criterion8 =
    directSupervisorCriterion(ratings, 'supervisorCooperation', 'supervisorCooperation', bulkFields) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {},
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_8,
    });

  const tasksMetric = renormalizeWeightedAverage([
    { value: metrics.tasksCompletionMetric, weight: 60 },
    { value: metrics.hoursMetric, weight: 25 },
    { value: metrics.onTimeMetric, weight: 15 },
  ]);
  results.criterion9 =
    derivedCriterion(tasksMetric, policy, {
      taskCompletionPercentage: metrics.tasksCompletionMetric,
      hoursCompletionPercentage: metrics.hoursMetric,
      onTimeSubmissionPercentage: metrics.onTimeMetric,
    }, { taskCompletion: 60, hours: 25, onTime: 15 }) ||
    buildCriterionResult({
      score: null,
      source: null,
      evidence: {
        taskCompletionPercentage: metrics.tasksCompletionMetric,
        hoursCompletionPercentage: metrics.hoursMetric,
      },
      missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_9,
    });

  results.criterion10 =
    directSupervisorCriterion(ratings, 'rulesCompliance', 'rulesCompliance', bulkFields) ||
    (() => {
      const rulesMetric = renormalizeWeightedAverage([
        { value: metrics.attendanceMetric, weight: 60 },
        { value: metrics.disciplineMetric, weight: 40 },
      ]);
      if (rulesMetric == null) {
        return buildCriterionResult({
          score: null,
          source: null,
          evidence: {
            attendancePercentage: snapshot.attendancePercentage,
            violationCount: snapshot.violationCount,
          },
          missingEvidence: PROFESSIONAL_CRITERION_EVIDENCE_CODES.CRITERION_10,
        });
      }
      return derivedCriterion(rulesMetric, policy, {
        attendancePercentage: snapshot.attendancePercentage,
        violationCount: snapshot.violationCount,
        disciplineMetric: metrics.disciplineMetric,
      }, { attendance: 60, discipline: 40 });
    })();

  return {
    criteria: {
      criterion1: results.criterion1.score,
      criterion2: results.criterion2.score,
      criterion3: results.criterion3.score,
      criterion4: results.criterion4.score,
      criterion5: results.criterion5.score,
      criterion6: results.criterion6.score,
      criterion7: results.criterion7.score,
      criterion8: results.criterion8.score,
      criterion9: results.criterion9.score,
      criterion10: results.criterion10.score,
    },
    criterionEvidence: {
      criterion1: results.criterion1,
      criterion2: results.criterion2,
      criterion3: results.criterion3,
      criterion4: results.criterion4,
      criterion5: results.criterion5,
      criterion6: results.criterion6,
      criterion7: results.criterion7,
      criterion8: results.criterion8,
      criterion9: results.criterion9,
      criterion10: results.criterion10,
    },
    performanceSnapshot: snapshot,
  };
}

function evaluateGates(input, policy) {
  const reasons = [];
  const requiredHours = toNumber(policy.requiredTrainingHours, toNumber(input.requiredHours));
  const completedHours = toNumber(input.completedHours);
  if (requiredHours != null && requiredHours > 0 && completedHours != null && completedHours < requiredHours) {
    reasons.push(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED);
  } else if (requiredHours != null && requiredHours > 0 && completedHours == null) {
    reasons.push(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED);
  }

  const attendance = toNumber(input.attendancePercentage);
  if (
    policy.minimumAttendancePercentage != null &&
    (attendance == null || attendance < policy.minimumAttendancePercentage)
  ) {
    reasons.push(GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED);
  }

  const requiredTasks = toNumber(input.requiredTaskCount);
  const acceptedTasks = toNumber(input.acceptedTaskCount);
  if (
    policy.requiredTasksRequired &&
    requiredTasks != null &&
    requiredTasks > 0 &&
    (acceptedTasks == null || acceptedTasks < requiredTasks)
  ) {
    reasons.push(GATE_REASONS.REQUIRED_SUBMISSION_MISSING);
  }

  if (policy.postAssessmentRequired && toNumber(input.postAssessmentScore) == null) {
    reasons.push(GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED);
  }

  const ratingsComplete = supervisorRatingsComplete(input.supervisorRatings);

  return {
    eligible: reasons.length === 0,
    reasons,
    ratingsComplete,
  };
}

function professionalTotals(criteria, { required = true } = {}) {
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

function usesManualRating(criterionEvidence = {}) {
  return Object.values(criterionEvidence).some(
    (row) =>
      row?.source === SCORE_SOURCE.DIRECT_SUPERVISOR_RATING ||
      row?.source === SCORE_SOURCE.MANUAL_AUTHORIZED_EVALUATION ||
      row?.source === SCORE_SOURCE.MANUAL_AUTHORIZED_BULK_RATING
  );
}

/**
 * Pure scoring. Eligibility is independent of PASSED/FAILED and professional completeness.
 */
function calculateFinalEvaluation(rawInput = {}, rawPolicy = {}) {
  const policyCheck = validatePolicyWeights(rawPolicy);
  const policy = policyCheck.policy;
  const input = rawInput || {};
  const gates = evaluateGates(input, policy);
  const derived = criterionFromEvidence(input, policy);
  const criteria = derived.criteria;
  const professional = professionalTotals(criteria, {
    required: policy.professionalEvaluationRequired,
  });

  const attendanceComponent = round1(input.attendancePercentage);
  const requiredTasks = toNumber(input.requiredTaskCount);
  const acceptedTasks = toNumber(input.acceptedTaskCount);
  const tasksComponent =
    requiredTasks != null && requiredTasks > 0 && acceptedTasks != null
      ? round1((acceptedTasks / requiredTasks) * 100)
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
    criterionEvidence: derived.criterionEvidence,
    performanceSnapshot: derived.performanceSnapshot,
    professionalTotal: professional.total,
    professionalPercentage: professional.percentage,
    finalScore,
    finalPercentage: finalScore,
    ratingsComplete: gates.ratingsComplete,
    usesManualRating: usesManualRating(derived.criterionEvidence),
    policy,
  };
}

module.exports = {
  toNumber,
  round1,
  clampScore15,
  average,
  score100ToFivePoint,
  mapPercentToFive,
  mapAttendanceBand,
  renormalizeWeightedAverage,
  normalizePolicy,
  validatePolicyWeights,
  supervisorRatingsComplete,
  averageSupervisorRatings,
  evaluateGates,
  criterionFromEvidence,
  calculateFinalEvaluation,
  buildCriterionResult,
  usesManualRating,
};
