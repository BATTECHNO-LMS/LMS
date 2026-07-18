'use strict';

const { ApiError } = require('../../utils/apiError');

/** Stable client code for finalized academic grade conflicts. */
const GRADE_FINALIZED = 'GRADE_FINALIZED';

const FINALIZED_IMMUTABLE_MESSAGE =
  'This grade is finalized and cannot be modified through ordinary update operations';

/**
 * Whether an academic grade row is finalized.
 * @param {{ is_final?: boolean } | null | undefined} grade
 */
function isGradeFinal(grade) {
  return Boolean(grade?.is_final);
}

/**
 * Central mutability guard for ordinary academic grade content changes.
 * Throws ApiError 409 / GRADE_FINALIZED when the grade is finalized.
 * Applies to all roles through ordinary update/create-overwrite paths
 * (no super_admin bypass; no separate moderation override exists).
 *
 * @param {{ is_final?: boolean } | null | undefined} grade
 */
function assertGradeMutable(grade) {
  if (isGradeFinal(grade)) {
    throw new ApiError(409, FINALIZED_IMMUTABLE_MESSAGE, undefined, GRADE_FINALIZED);
  }
}

/**
 * Reject create/overwrite that would mutate an existing finalized grade.
 * @param {{ is_final?: boolean } | null | undefined} existingFinal
 */
function assertNoFinalizedGradeOverwrite(existingFinal) {
  if (existingFinal) {
    throw new ApiError(409, FINALIZED_IMMUTABLE_MESSAGE, undefined, GRADE_FINALIZED);
  }
}

/**
 * Score must be within the same 0–100 contract as create/update validators.
 * @param {unknown} score
 */
function assertGradeScoreInRange(score) {
  const n = Number(score);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new ApiError(400, 'score must be between 0 and 100');
  }
  return n;
}

module.exports = {
  GRADE_FINALIZED,
  FINALIZED_IMMUTABLE_MESSAGE,
  isGradeFinal,
  assertGradeMutable,
  assertNoFinalizedGradeOverwrite,
  assertGradeScoreInRange,
};
