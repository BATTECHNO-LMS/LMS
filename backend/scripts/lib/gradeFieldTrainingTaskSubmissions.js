'use strict';

const crypto = require('crypto');

const MIN_MARK = 80;
const MAX_MARK = 90;
const MARK_SPAN = MAX_MARK - MIN_MARK + 1; // 11

/**
 * Deterministic unsigned 32-bit hash of a submission id.
 * @param {string} submissionId
 * @returns {number}
 */
function stableHash(submissionId) {
  const digest = crypto.createHash('sha256').update(String(submissionId), 'utf8').digest();
  return digest.readUInt32BE(0);
}

/**
 * Integer percentage in [80, 90] derived only from the submission id.
 * @param {string} submissionId
 * @returns {number}
 */
function markFromSubmissionId(submissionId) {
  return MIN_MARK + (stableHash(submissionId) % MARK_SPAN);
}

/**
 * Convert a 0–100 percentage into stored submission scores.
 * If max_score is missing or 100, store the percentage out of 100.
 * Otherwise treat max_score as raw points and scale, never exceeding max.
 *
 * @param {number} percent
 * @param {unknown} existingMaxScore
 * @returns {{ manual_score: number, max_score: number, percent: number }}
 */
function toStoredScores(percent, existingMaxScore) {
  const pct = Number(percent);
  const existing = existingMaxScore == null ? null : Number(existingMaxScore);
  const max = existing != null && Number.isFinite(existing) && existing > 0 ? existing : 100;
  if (max === 100) {
    return { manual_score: pct, max_score: 100, percent: pct };
  }
  const raw = Math.round((pct / 100) * max * 100) / 100;
  const capped = Math.min(max, Math.max(0, raw));
  return { manual_score: capped, max_score: max, percent: pct };
}

function hasText(value) {
  return Boolean(value && String(value).trim());
}

function hasActualStudentSubmission(row) {
  if (hasText(row.file_path) || hasText(row.project_url)) return true;
  if (Array.isArray(row.files) && row.files.length > 0) return true;
  if (Array.isArray(row.field_training_task_submission_files) && row.field_training_task_submission_files.length) {
    return true;
  }
  return (
    hasText(row.solution_notes) ||
    hasText(row.final_student_notes) ||
    hasText(row.student_self_evaluation_input)
  );
}

function expelledBeforeSubmitting(app, submittedAt) {
  if (!app) return false;
  const expelledAt = app.expelled_at ? new Date(app.expelled_at) : null;
  const markedExpelled = app.training_status === 'expelled' || Boolean(expelledAt);
  if (!markedExpelled) return false;
  if (!submittedAt) return true;
  if (expelledAt && expelledAt.getTime() < new Date(submittedAt).getTime()) return true;
  return false;
}

/**
 * Classify a loaded submission row. Does not mutate.
 * @returns {{ eligible: boolean, reason?: string }}
 */
function classifySubmission(row) {
  if (!row?.id) return { eligible: false, reason: 'invalid_orphan' };
  if (!row.task_id || !row.application_id || !row.student_id) {
    return { eligible: false, reason: 'invalid_orphan' };
  }
  if (!row.task && !row.field_training_tasks) {
    return { eligible: false, reason: 'invalid_orphan' };
  }
  const app = row.application || row.field_training_applications;
  if (!app) return { eligible: false, reason: 'invalid_orphan' };
  if (app.status === 'cancelled') return { eligible: false, reason: 'cancelled_application' };
  if (!row.submitted_at) return { eligible: false, reason: 'draft_or_incomplete' };
  if (!hasActualStudentSubmission(row)) return { eligible: false, reason: 'no_actual_submission' };
  if (expelledBeforeSubmitting(app, row.submitted_at)) {
    return { eligible: false, reason: 'expelled_before_submit' };
  }
  return { eligible: true };
}

function wasPreviouslyGraded(row) {
  if (row.manual_score != null && Number.isFinite(Number(row.manual_score))) return true;
  return ['graded', 'approved'].includes(row.review_status) && row.reviewed_at != null;
}

const ELIGIBILITY_STATUS = {
  eligible: 'eligible',
  ineligible: 'ineligible',
  needs_review: 'needs_review',
};

function isExpelledApp(app) {
  return app?.training_status === 'expelled' || Boolean(app?.expelled_at);
}

/**
 * Same rules as calculateFieldTrainingEligibility, using already-loaded rows
 * (no extra queries). Hours progress must be supplied when the opportunity
 * requires training hours.
 */
function computeEligibilityFromLoaded(app, hoursProgress = null) {
  const opp = app.field_training_opportunities || app.opportunity || null;
  const reasons = [];
  const details = {};
  if (!app) {
    return { outcome: 'ineligible', reasons: ['application_not_found'], details };
  }
  if (isExpelledApp(app)) {
    return { outcome: 'ineligible', reasons: ['expelled'], details: {} };
  }
  if (app.training_status === 'failed') {
    return { outcome: 'ineligible', reasons: ['failed'], details: {} };
  }
  if (!opp) {
    return { outcome: 'ineligible', reasons: ['opportunity_missing'], details: {} };
  }

  if (opp.minimum_attendance_percentage != null) {
    const pct = app.attendance_percentage != null ? Number(app.attendance_percentage) : null;
    details.attendance_percentage = pct;
    if (pct == null || pct < Number(opp.minimum_attendance_percentage)) {
      reasons.push('attendance_below_minimum');
    }
  }

  if (opp.required_training_hours != null && Number(opp.required_training_hours) > 0) {
    details.training_hours = hoursProgress || null;
    if (!hoursProgress || hoursProgress.hours_completion_status !== 'completed') {
      reasons.push('training_hours_incomplete');
    }
  }

  if (opp.requires_post_assessment) {
    details.post_assessment_score =
      app.post_assessment_score != null ? Number(app.post_assessment_score) : null;
    if (app.post_assessment_score == null) {
      reasons.push('post_assessment_missing');
    } else if (
      opp.minimum_post_assessment_score != null &&
      Number(app.post_assessment_score) < Number(opp.minimum_post_assessment_score)
    ) {
      reasons.push('post_assessment_below_minimum');
    }
  }

  if (opp.requires_final_task) {
    const subs = app.field_training_task_submissions || app.submissions || [];
    const finalSub = subs.find((s) => s.field_training_tasks?.is_final_task || s.is_final_task);
    details.final_task_status = app.final_task_status;
    if (!finalSub) {
      reasons.push('final_task_not_submitted');
    } else if (finalSub.review_status === 'rejected') {
      reasons.push('final_task_rejected');
    } else if (finalSub.review_status === 'pending' || finalSub.review_status === 'needs_revision') {
      reasons.push('final_task_pending_review');
    }
  }

  const manualReview = Boolean(opp.completion_rules?.manual_review_required);
  if (reasons.some((r) => r.endsWith('_pending_review'))) {
    return { outcome: 'needs_review', reasons, details };
  }
  if (reasons.length) {
    return { outcome: 'ineligible', reasons, details };
  }
  if (manualReview) {
    return { outcome: 'needs_review', reasons: [], details };
  }
  return { outcome: 'eligible', reasons: [], details };
}

function eligibilityUpdateData(app, result) {
  const skipStatusChange = ['completed', 'expelled', 'failed'].includes(app.training_status);
  return {
    completion_eligibility_status: ELIGIBILITY_STATUS[result.outcome],
    eligibility_reason: { reasons: result.reasons, details: result.details },
    ...(result.outcome === 'eligible' && !skipStatusChange
      ? { training_status: 'eligible_for_completion' }
      : {}),
  };
}

module.exports = {
  MIN_MARK,
  MAX_MARK,
  MARK_SPAN,
  stableHash,
  markFromSubmissionId,
  toStoredScores,
  hasActualStudentSubmission,
  expelledBeforeSubmitting,
  classifySubmission,
  wasPreviouslyGraded,
  computeEligibilityFromLoaded,
  eligibilityUpdateData,
};

