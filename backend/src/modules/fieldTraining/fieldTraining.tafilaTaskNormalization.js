'use strict';

/**
 * Historical Tafila cohort ONLY — submitted-task 80–90 normalization
 * and submitted-only task-component average.
 * Opportunity: 4d9466cb-127b-42f2-ac08-88e7fcc7c7df
 */

const SOURCE = Object.freeze({
  AUTHORIZED_MANUAL_REVIEW: 'AUTHORIZED_MANUAL_REVIEW',
  AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT: 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT',
  EXCEL_BASELINE: 'EXCEL_BASELINE',
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

/** approved = 80 + (raw/100)*10 */
function normalizeSubmittedTaskScore(rawTaskScore) {
  if (rawTaskScore == null || rawTaskScore === '' || !Number.isFinite(Number(rawTaskScore))) {
    return 80;
  }
  return round1(80 + (Number(rawTaskScore) / 100) * 10);
}

function isTaskSubmittedDetail(detail = {}) {
  if (detail.accepted === true) return true;
  const status = String(detail.reviewStatus || detail.review_status || '').toLowerCase();
  if (!status || status === 'missing' || status === 'not_submitted') return false;
  if (detail.source === 'MISSING_OR_NOT_ACCEPTED') return false;
  return ['submitted', 'under_review', 'approved', 'graded', 'needs_revision', 'pending'].includes(
    status
  );
}

function buildNormalizedTaskEvaluation(taskDetails = []) {
  const details = (Array.isArray(taskDetails) ? taskDetails : []).map((d) => {
    const submitted = isTaskSubmittedDetail(d);
    if (!submitted) {
      return {
        taskId: d.taskId || null,
        title: d.title || null,
        submissionStatus: 'NOT_SUBMITTED',
        submissionStatusAr: 'غير مسلّم',
        rawTaskScore: d.rawScore != null && Number.isFinite(Number(d.rawScore)) ? Number(d.rawScore) : null,
        approvedTaskScore: null,
        source: null,
      };
    }
    const raw =
      d.rawScore != null && Number.isFinite(Number(d.rawScore)) ? Number(d.rawScore) : null;
    return {
      taskId: d.taskId || null,
      title: d.title || null,
      submissionStatus: 'SUBMITTED',
      submissionStatusAr: 'مسلّم',
      rawTaskScore: raw,
      approvedTaskScore: normalizeSubmittedTaskScore(raw),
      source: SOURCE.AUTHORIZED_MANUAL_REVIEW,
    };
  });

  const submitted = details.filter((d) => d.submissionStatus === 'SUBMITTED');
  let approvedTaskPoints = null;
  let approvedTaskAverage = null;
  if (submitted.length) {
    approvedTaskAverage = round1(
      submitted.reduce((sum, d) => sum + Number(d.approvedTaskScore), 0) / submitted.length
    );
    approvedTaskPoints = round1((approvedTaskAverage / 100) * 40);
  }

  return {
    details,
    submittedCount: submitted.length,
    requiredCount: details.length,
    approvedTaskAverage,
    approvedTaskPoints,
  };
}

/**
 * Historically ELIGIBLE score after 80–90 task normalization.
 */
function computeEligibleApprovedScore({
  attendancePoints,
  postAssessmentPoints,
  behaviorPoints,
  rawTaskPoints,
  excelScore,
  taskDetails = [],
}) {
  // Historical authorized review: missing LMS component points count as 0 so
  // approvedFinalScore always equals the displayed breakdown sum.
  const att = attendancePoints == null ? 0 : Number(attendancePoints);
  const post = postAssessmentPoints == null ? 0 : Number(postAssessmentPoints);
  const beh = behaviorPoints == null ? 0 : Number(behaviorPoints);
  const normalized = buildNormalizedTaskEvaluation(taskDetails);
  const oldRawTasks = rawTaskPoints == null ? 0 : Number(rawTaskPoints);

  const base = round1(att + post + beh);
  const minTasks = round1(clamp(80 - base, 0, 40));

  if (normalized.submittedCount === 0) {
    let approvedTasks = minTasks;
    if (excelScore != null && Number(excelScore) >= 80) {
      approvedTasks = round1(clamp(Number(excelScore) - base, minTasks, 40));
    } else if (excelScore != null) {
      const excelBoost = clamp(round1((Number(excelScore) - 65) * 0.35), 0, 8);
      approvedTasks = round1(clamp(minTasks + excelBoost, minTasks, 40));
    }
    let finalScore = round1(base + approvedTasks);
    if (finalScore < 80) {
      approvedTasks = minTasks;
      finalScore = round1(base + approvedTasks);
    }
    if (finalScore > 100) {
      approvedTasks = round1(clamp(100 - base, 0, 40));
      finalScore = round1(base + approvedTasks);
    }
    return {
      ok: true,
      approvedTaskPoints: approvedTasks,
      approvedFinalScore: finalScore,
      source: SOURCE.AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT,
      incompleteComponents: false,
      taskCorrected: true,
      taskEvaluation: normalized,
      oldTaskComponent: oldRawTasks,
    };
  }

  let approvedTasks = normalized.approvedTaskPoints;
  let finalScore = round1(base + approvedTasks);
  if (finalScore < 80) {
    approvedTasks = round1(Math.max(approvedTasks, minTasks));
    finalScore = round1(base + approvedTasks);
  }
  if (finalScore > 100) {
    approvedTasks = round1(clamp(100 - base, 0, 40));
    finalScore = round1(base + approvedTasks);
  }

  return {
    ok: true,
    approvedTaskPoints: approvedTasks,
    approvedFinalScore: finalScore,
    source: SOURCE.AUTHORIZED_MANUAL_REVIEW,
    incompleteComponents: false,
    taskCorrected: true,
    taskEvaluation: normalized,
    oldTaskComponent: oldRawTasks,
  };
}

module.exports = {
  SOURCE,
  normalizeSubmittedTaskScore,
  isTaskSubmittedDetail,
  buildNormalizedTaskEvaluation,
  computeEligibleApprovedScore,
  round1,
  clamp,
};
