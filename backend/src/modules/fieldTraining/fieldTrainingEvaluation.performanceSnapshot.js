'use strict';

const { ACCEPTED_TASK_STATUSES } = require('./fieldTrainingEvaluation.constants');

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

function clampMetric0to100(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(100, round1(n)));
}

function ratioPercent(numerator, denominator) {
  const num = toNumber(numerator);
  const den = toNumber(denominator);
  if (num == null || den == null || den <= 0) return null;
  return clampMetric0to100((num / den) * 100);
}

function improvementMetric(pre, post) {
  const preScore = toNumber(pre);
  const postScore = toNumber(post);
  if (preScore == null || postScore == null) return null;
  return clampMetric0to100(postScore);
}

/**
 * Single normalized performance snapshot for one student application.
 * Used by scoring, readiness, preview, and generate — never recalculate elsewhere.
 */
function buildFieldTrainingStudentPerformanceSnapshot(rawInput = {}, policy = {}) {
  const input = rawInput || {};
  const requiredHours = toNumber(input.requiredHours, toNumber(policy.requiredTrainingHours));
  const completedHours = toNumber(input.completedHours);
  const requiredTasks = toNumber(input.requiredTaskCount);
  const acceptedTasks = toNumber(input.acceptedTaskCount);
  const submittedTasks = toNumber(input.submittedTaskCount);
  const gradedTasks = toNumber(input.gradedTaskCount);
  const rejectedTasks = toNumber(input.rejectedTaskCount);
  const lateTasks = toNumber(input.lateTaskCount);
  const onTimeTasks = toNumber(input.onTimeTaskCount);

  const attendancePercentage = clampMetric0to100(input.attendancePercentage);
  const hoursMetric = ratioPercent(completedHours, requiredHours);
  const taskCompletionMetric =
    ratioPercent(acceptedTasks, requiredTasks) ?? clampMetric0to100(input.taskCompletionPercent);
  const taskQualityMetric = clampMetric0to100(input.taskScoreAveragePercent);
  const preAssessmentMetric = clampMetric0to100(input.preAssessmentScore);
  const postAssessmentMetric = clampMetric0to100(input.postAssessmentScore);
  const assessmentImprovementMetric = improvementMetric(input.preAssessmentScore, input.postAssessmentScore);

  const requiredSubmissions = toNumber(input.requiredSubmissionCount);
  const onTimeMetric =
    ratioPercent(onTimeTasks, requiredSubmissions) ??
    (acceptedTasks != null && lateTasks != null && acceptedTasks > 0
      ? clampMetric0to100(((acceptedTasks - lateTasks) / acceptedTasks) * 100)
      : null);

  const attendanceDataLoaded = input.attendanceDataLoaded === true;
  const hoursDataLoaded = input.hoursDataLoaded === true;
  const latenessTracked = input.latenessTracked === true;
  const violationsTracked = input.violationsTracked === true;
  const violationCount = violationsTracked ? toNumber(input.violationCount, 0) : null;

  let disciplineMetric = null;
  if (violationsTracked && violationCount != null) {
    if (violationCount === 0) disciplineMetric = 100;
    else if (violationCount === 1) disciplineMetric = 70;
    else if (violationCount === 2) disciplineMetric = 50;
    else disciplineMetric = 30;
  }

  const supervisorRatings = input.supervisorRatings || {};
  const explicitRatings = input.explicitSupervisorRatings || supervisorRatings;

  return {
    studentId: input.studentId || null,
    applicationId: input.applicationId || null,
    attendancePercentage,
    attendedDays: toNumber(input.attendedDays),
    absenceDays: input.absenceDays === undefined ? null : toNumber(input.absenceDays),
    lateDays: latenessTracked ? toNumber(input.lateDays) : null,
    completedTrainingHours: completedHours,
    requiredTrainingHours: requiredHours,
    hoursCompletionPercentage: hoursMetric,
    requiredTasks,
    submittedTasks,
    acceptedTasks,
    gradedTasks,
    rejectedTasks,
    lateTaskCount: lateTasks,
    onTimeTaskCount: onTimeTasks,
    taskCompletionPercentage: taskCompletionMetric,
    averageTaskScore: taskQualityMetric,
    onTimeSubmissionPercentage: onTimeMetric,
    preAssessmentScore: preAssessmentMetric,
    postAssessmentScore: postAssessmentMetric,
    assessmentImprovement: assessmentImprovementMetric,
    preAssessmentRaw: toNumber(input.preAssessmentScore),
    postAssessmentRaw: toNumber(input.postAssessmentScore),
    supervisorRatings: supervisorRatings,
    explicitSupervisorRatings: explicitRatings,
    violationCount,
    disciplineMetric,
    completionEligibilityStatus: input.completionEligibilityStatus || null,
    completionEligibilityReasons: Array.isArray(input.completionEligibilityReasons)
      ? input.completionEligibilityReasons
      : [],
    metrics: {
      attendanceMetric: attendancePercentage,
      hoursMetric,
      tasksCompletionMetric: taskCompletionMetric,
      taskQualityMetric,
      postAssessmentMetric,
      onTimeMetric,
      assessmentImprovementMetric,
      disciplineMetric,
    },
    tracking: {
      attendanceDataLoaded,
      hoursDataLoaded,
      latenessTracked,
      violationsTracked,
      postAssessmentRequired: policy.postAssessmentRequired !== false,
      postAssessmentCompleted: postAssessmentMetric != null,
    },
    acceptedTaskStatuses: ACCEPTED_TASK_STATUSES,
  };
}

module.exports = {
  clampMetric0to100,
  ratioPercent,
  improvementMetric,
  buildFieldTrainingStudentPerformanceSnapshot,
};
