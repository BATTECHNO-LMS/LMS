const { ApiError } = require('../../utils/apiError');
const { resolvePrimaryUniversityId, resolveStudentSpecialtyId } = require('../../utils/studentScope');
const {
  isSystemWideAdmin,
  assertUniversityRecordAccess,
} = require('../../utils/universityScope');

const NO_UNIVERSITY_MSG = 'لا يمكن عرض فرص التدريب قبل ربط حسابك بجامعة.';
const NO_SPECIALTY_MSG = 'لا يمكن عرض فرص التدريب قبل تحديد التخصص.';

/**
 * @param {string} studentId
 * @returns {Promise<string>}
 */
async function requireStudentUniversityId(studentId) {
  const uniId = await resolvePrimaryUniversityId({ userId: studentId });
  if (!uniId) {
    throw new ApiError(403, NO_UNIVERSITY_MSG, null, 'FIELD_TRAINING_STUDENT_UNIVERSITY_REQUIRED');
  }
  return uniId;
}

/**
 * @param {string} studentId
 * @returns {Promise<string>}
 */
async function requireStudentSpecialtyId(studentId) {
  const specialtyId = await resolveStudentSpecialtyId({ userId: studentId });
  if (!specialtyId) {
    throw new ApiError(403, NO_SPECIALTY_MSG, null, 'FIELD_TRAINING_STUDENT_SPECIALTY_REQUIRED');
  }
  return specialtyId;
}

/**
 * @param {{ isGlobal?: boolean, roles?: string[], universityId?: string | null }} user
 * @param {Record<string, unknown>} query
 */
function assertAdminOpportunityAccess(user, opportunity) {
  if (isSystemWideAdmin(user)) return;
  if (!opportunity?.university_id) return;
  assertUniversityRecordAccess(user, opportunity.university_id);
}

/**
 * Field training opportunities are specialty-scoped, not university-scoped.
 * University admins may list/manage all opportunities unless filtering legacy records.
 */
function scopeAdminListQuery(user, query) {
  if (isSystemWideAdmin(user)) {
    return query;
  }
  return query;
}

module.exports = {
  NO_UNIVERSITY_MSG,
  NO_SPECIALTY_MSG,
  requireStudentUniversityId,
  requireStudentSpecialtyId,
  scopeAdminListQuery,
  assertAdminOpportunityAccess,
  isSystemWideAdmin,
};
