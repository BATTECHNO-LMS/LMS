'use strict';

const crypto = require('crypto');
const { ELIGIBILITY_REASON_CODES } = require('./fieldTrainingEvaluation.constants');
const {
  buildFieldTrainingEligibilityReasons,
  isEligibleStatus,
} = require('./fieldTrainingEvaluation.eligibilityReasons');
const {
  SCORE_SOURCE,
  FALLBACK_VERSION,
  ELIGIBLE_AR,
  NOT_ELIGIBLE_AR,
  EXCEL_REASON_LABELS_AR,
  UNAVAILABLE_AR,
  EMPTY_TASKS_FALLBACK,
} = require('./fieldTrainingExcelEvaluation.constants');

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  const nums = (values || []).map((v) => toNumber(v)).filter((v) => v != null);
  if (!nums.length) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function percentToTen(pct) {
  const n = toNumber(pct);
  if (n == null) return null;
  return Math.max(1, Math.min(10, Math.round(n / 10)));
}

function supervisorToTen(score) {
  const n = toNumber(score);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return Math.round(n * 2);
  if (n >= 1 && n <= 10) return Math.round(n);
  return null;
}

function seededFallback7to9(applicationId, opportunityId, criterionCode) {
  const digest = crypto
    .createHash('sha256')
    .update(`${applicationId}|${opportunityId}|${criterionCode}|${FALLBACK_VERSION}`)
    .digest();
  return 7 + (digest[0] % 3);
}

function resolveTenPointRating({
  eligible,
  applicationId,
  opportunityId,
  criterionCode,
  supervisorScore = null,
  performancePercent = null,
} = {}) {
  if (!eligible) {
    return { score: 0, source: SCORE_SOURCE.NOT_ELIGIBLE_ZERO };
  }
  const fromSupervisor = supervisorToTen(supervisorScore);
  if (fromSupervisor != null) {
    return { score: fromSupervisor, source: SCORE_SOURCE.REAL_SUPERVISOR_RATING };
  }
  const fromPerformance = percentToTen(performancePercent);
  if (fromPerformance != null) {
    return { score: fromPerformance, source: SCORE_SOURCE.PERFORMANCE_DERIVED };
  }
  return {
    score: seededFallback7to9(applicationId, opportunityId, criterionCode),
    source: SCORE_SOURCE.ADMINISTRATIVE_FALLBACK_7_9,
  };
}

function excelEligibilityStatus(application = {}) {
  return isEligibleStatus(application.completion_eligibility_status) ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
}

function excelStatusLabel(status) {
  return status === 'ELIGIBLE' ? ELIGIBLE_AR : NOT_ELIGIBLE_AR;
}

function excelIneligibilityReason(application = {}, evidence = {}) {
  if (excelEligibilityStatus(application) === 'ELIGIBLE') return '';
  const built = buildFieldTrainingEligibilityReasons({ application, evidence });
  const labels = (built.items || []).map((item) => {
    if (EXCEL_REASON_LABELS_AR[item.code]) return EXCEL_REASON_LABELS_AR[item.code];
    return item.text || EXCEL_REASON_LABELS_AR[ELIGIBILITY_REASON_CODES.OTHER_EXISTING_ELIGIBILITY_RULE];
  });
  const unique = [...new Set(labels.filter(Boolean))];
  if (!unique.length) return EXCEL_REASON_LABELS_AR[ELIGIBILITY_REASON_CODES.OTHER_EXISTING_ELIGIBILITY_RULE];
  if (unique.length === 1) return unique[0];
  return `${unique.map((text) => String(text).replace(/[.]+$/g, '')).join('؛ ')}.`;
}

function snapshotMetrics(snapshot = {}) {
  return snapshot.metrics || {};
}

function commitmentPercent(snapshot = {}, scoringInput = {}) {
  const metrics = snapshotMetrics(snapshot);
  const attendance = toNumber(
    metrics.attendanceMetric ?? snapshot.attendancePercentage ?? scoringInput.attendancePercentage
  );
  const hoursMetric = toNumber(metrics.hoursMetric ?? snapshot.hoursCompletionPercentage);
  return average([attendance, hoursMetric]);
}

function onTimePercent(snapshot = {}) {
  const metrics = snapshotMetrics(snapshot);
  return toNumber(
    metrics.onTimeMetric ??
      snapshot.onTimeSubmissionPercentage ??
      metrics.tasksCompletionMetric ??
      snapshot.taskCompletionPercentage
  );
}

function qualityPercent(snapshot = {}) {
  const metrics = snapshotMetrics(snapshot);
  return toNumber(metrics.taskQualityMetric ?? snapshot.averageTaskScore);
}

function learningPercent(snapshot = {}) {
  const metrics = snapshotMetrics(snapshot);
  return toNumber(
    metrics.postAssessmentMetric ??
      snapshot.postAssessmentScore ??
      metrics.assessmentImprovementMetric ??
      metrics.taskQualityMetric
  );
}

function problemSolvingPercent(snapshot = {}) {
  const metrics = snapshotMetrics(snapshot);
  return average([
    metrics.taskQualityMetric ?? snapshot.averageTaskScore,
    metrics.postAssessmentMetric ?? snapshot.postAssessmentScore,
  ]);
}

function generalScoreFromCriteria(scores = []) {
  const nums = scores.map((n) => toNumber(n)).filter((n) => n != null);
  if (!nums.length) return 0;
  const max = nums.length * 10;
  return Math.round((nums.reduce((sum, n) => sum + n, 0) / max) * 100);
}

function buildTaskDescription(taskTitles = []) {
  const lines = [...new Set((taskTitles || []).map((title) => String(title || '').trim()).filter(Boolean))];
  return lines.length ? lines.join('\n') : EMPTY_TASKS_FALLBACK;
}

function hoursDisplay(completedHours) {
  const n = toNumber(completedHours);
  if (n == null) return UNAVAILABLE_AR;
  return n;
}

function buildStudentExcelEvaluation({
  application = {},
  opportunity = {},
  scoringInput = {},
  performanceSnapshot = {},
  supervisorRatings = null,
  taskTitles = [],
} = {}) {
  const applicationId = application.id || scoringInput.applicationId;
  const opportunityId = opportunity.id || application.opportunity_id;
  const eligible = excelEligibilityStatus(application) === 'ELIGIBLE';
  const ratings = supervisorRatings || scoringInput.supervisorRatings || {};
  const snapshot = performanceSnapshot || {};

  const commitment = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'commitment',
    supervisorScore: ratings.rulesCompliance,
    performancePercent: commitmentPercent(snapshot, scoringInput),
  });
  const tasksOnTime = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'tasksOnTime',
    supervisorScore: null,
    performancePercent: onTimePercent(snapshot),
  });
  const taskQuality = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'taskQuality',
    supervisorScore: null,
    performancePercent: qualityPercent(snapshot),
  });
  const learning = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'learning',
    supervisorScore: ratings.thinkingAndInitiative,
    performancePercent: learningPercent(snapshot),
  });
  const cooperation = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'cooperation',
    supervisorScore: ratings.supervisorCooperation,
  });
  const teamwork = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'teamwork',
    supervisorScore: ratings.teamwork,
  });
  const communication = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'communication',
    supervisorScore: ratings.professionalConduct,
  });
  const problemSolving = resolveTenPointRating({
    eligible,
    applicationId,
    opportunityId,
    criterionCode: 'problemSolving',
    supervisorScore: ratings.problemSolving,
    performancePercent: problemSolvingPercent(snapshot),
  });
  const problemSolvingDuplicate = {
    score: problemSolving.score,
    source: problemSolving.source,
  };

  const scored = [
    commitment,
    tasksOnTime,
    taskQuality,
    learning,
    cooperation,
    teamwork,
    communication,
    problemSolving,
    problemSolvingDuplicate,
  ];
  const generalScore = eligible ? generalScoreFromCriteria(scored.map((row) => row.score)) : 0;

  return {
    eligible,
    status: excelStatusLabel(eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'),
    ineligibilityReason: excelIneligibilityReason(application, {
      attendancePercentage: scoringInput.attendancePercentage,
      completedHours: scoringInput.completedHours,
      requiredHours: scoringInput.requiredHours,
      requiredTaskCount: scoringInput.requiredTaskCount,
      acceptedTaskCount: scoringInput.acceptedTaskCount,
    }),
    hours: hoursDisplay(scoringInput.completedHours),
    ratings: {
      commitment,
      tasksOnTime,
      taskQuality,
      learning,
      cooperation,
      teamwork,
      communication,
      problemSolving,
      problemSolvingDuplicate,
    },
    generalScore,
    tasksText: buildTaskDescription(taskTitles),
    usedAdministrativeFallback: scored.some((row) => row.source === SCORE_SOURCE.ADMINISTRATIVE_FALLBACK_7_9),
    usedPerformanceDerived: scored.some((row) => row.source === SCORE_SOURCE.PERFORMANCE_DERIVED),
    usedSupervisorRating: scored.some((row) => row.source === SCORE_SOURCE.REAL_SUPERVISOR_RATING),
  };
}

module.exports = {
  toNumber,
  percentToTen,
  supervisorToTen,
  seededFallback7to9,
  resolveTenPointRating,
  excelEligibilityStatus,
  excelStatusLabel,
  excelIneligibilityReason,
  generalScoreFromCriteria,
  buildTaskDescription,
  hoursDisplay,
  buildStudentExcelEvaluation,
  SCORE_SOURCE,
};
