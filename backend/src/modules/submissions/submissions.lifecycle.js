'use strict';

const { ApiError } = require('../../utils/apiError');

/** Stable client code when a student already has a submission for an assessment. */
const ACADEMIC_SUBMISSION_EXISTS = 'ACADEMIC_SUBMISSION_EXISTS';

const SUBMISSION_EXISTS_MESSAGE =
  'A submission already exists for this assessment. Use the update endpoint to change it.';

/**
 * Reject create when a row already exists for the canonical key
 * (assessment_id + student_id).
 * @param {{ id?: string } | null | undefined} existing
 */
function assertNoExistingAcademicSubmission(existing) {
  if (existing) {
    throw new ApiError(409, SUBMISSION_EXISTS_MESSAGE, undefined, ACADEMIC_SUBMISSION_EXISTS);
  }
}

/**
 * Map Prisma unique-constraint races on submissions to the stable conflict.
 * Does not expose Prisma codes to clients.
 * @param {unknown} err
 */
function mapAcademicSubmissionUniqueConflict(err) {
  if (!err || typeof err !== 'object') return null;
  const e = /** @type {{ code?: string, meta?: { target?: string[] | string } }} */ (err);
  if (e.code !== 'P2002') return null;
  const target = e.meta?.target;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  const joined = fields.join(',').toLowerCase();
  const looksLikePair =
    fields.length === 0 ||
    (joined.includes('assessment_id') && joined.includes('student_id')) ||
    joined.includes('uq_submissions_assessment_student');
  if (!looksLikePair) return null;
  return new ApiError(409, SUBMISSION_EXISTS_MESSAGE, undefined, ACADEMIC_SUBMISSION_EXISTS);
}

module.exports = {
  ACADEMIC_SUBMISSION_EXISTS,
  SUBMISSION_EXISTS_MESSAGE,
  assertNoExistingAcademicSubmission,
  mapAcademicSubmissionUniqueConflict,
};
