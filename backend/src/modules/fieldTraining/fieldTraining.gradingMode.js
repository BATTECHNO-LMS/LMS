/**
 * Field-training task grading mode helpers.
 * grading_mode is independent from is_final_task.
 */

const GRADING_MODES = Object.freeze(['AI', 'MANUAL', 'NONE']);

function normalizeGradingMode(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (GRADING_MODES.includes(raw)) return raw;
  return null;
}

/**
 * Resolve grading mode from task row (supports legacy requires_ai_self_evaluation).
 * @param {{ grading_mode?: string | null, requires_ai_self_evaluation?: boolean }} task
 */
function resolveGradingMode(task) {
  const fromColumn = normalizeGradingMode(task?.grading_mode);
  if (fromColumn) return fromColumn;
  return task?.requires_ai_self_evaluation ? 'AI' : 'MANUAL';
}

function requiresAiSelfEvaluation(task) {
  return resolveGradingMode(task) === 'AI';
}

function isManualGrading(task) {
  return resolveGradingMode(task) === 'MANUAL';
}

function isNoGrading(task) {
  return resolveGradingMode(task) === 'NONE';
}

/**
 * Sync requires_ai_self_evaluation boolean from grading_mode for legacy consumers.
 */
function syncRequiresAiFlag(gradingMode) {
  return normalizeGradingMode(gradingMode) === 'AI';
}

/**
 * Initial review_status after student submit, by grading mode.
 */
function initialReviewStatusForGradingMode(gradingMode) {
  const mode = normalizeGradingMode(gradingMode) || 'AI';
  if (mode === 'NONE') return 'approved';
  if (mode === 'MANUAL') return 'submitted';
  return 'pending';
}

module.exports = {
  GRADING_MODES,
  normalizeGradingMode,
  resolveGradingMode,
  requiresAiSelfEvaluation,
  isManualGrading,
  isNoGrading,
  syncRequiresAiFlag,
  initialReviewStatusForGradingMode,
};
