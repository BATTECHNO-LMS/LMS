const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { resolvePrimaryUniversityId, resolveStudentSpecialtyId } = require('../../utils/studentScope');
const {
  isSystemWideAdmin,
  assertUniversityRecordAccess,
} = require('../../utils/universityScope');

const NO_UNIVERSITY_MSG = 'لا يمكن عرض فرص التدريب قبل ربط حسابك بجامعة.';
const NO_SPECIALTY_MSG = 'لا يمكن عرض فرص التدريب قبل تحديد التخصص.';

function normalizeRoles(user) {
  return (user?.roles || []).map((r) => String(r).toLowerCase());
}

function isFieldTrainingAdmin(user) {
  if (isSystemWideAdmin(user)) return true;
  const roles = normalizeRoles(user);
  return roles.some((r) => env.FIELD_TRAINING_ADMIN_ROLE_CODES.includes(r));
}

function isAssignedInstructor(user, opportunity) {
  if (!user?.userId || !opportunity?.assigned_instructor_id) return false;
  const roles = normalizeRoles(user);
  if (!roles.includes('instructor')) return false;
  return String(opportunity.assigned_instructor_id) === String(user.userId);
}

function canManageFieldTraining(user, opportunity) {
  if (isFieldTrainingAdmin(user)) {
    if (!opportunity?.university_id) return true;
    try {
      assertUniversityRecordAccess(user, opportunity.university_id);
      return true;
    } catch {
      return false;
    }
  }
  return isAssignedInstructor(user, opportunity);
}

/**
 * @param {{ isGlobal?: boolean, roles?: string[], universityId?: string | null }} user
 * @param {Record<string, unknown>} opportunity
 */
function assertAdminOpportunityAccess(user, opportunity) {
  if (isSystemWideAdmin(user)) return;
  if (!opportunity?.university_id) return;
  assertUniversityRecordAccess(user, opportunity.university_id);
}

function assertManageOpportunityAccess(user, opportunity) {
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  if (!canManageFieldTraining(user, opportunity)) {
    throw new ApiError(403, 'غير مصرح بإدارة هذه الفرصة', null, 'FIELD_TRAINING_FORBIDDEN');
  }
}

/**
 * Prisma where fragment for listing opportunities a user may manage.
 */
function manageOpportunityListWhere(user) {
  if (isFieldTrainingAdmin(user)) return {};
  const roles = normalizeRoles(user);
  if (roles.includes('instructor')) {
    return { assigned_instructor_id: user.userId };
  }
  return { id: { in: [] } };
}

/**
 * Field training opportunities are specialty-scoped, not university-scoped.
 */
function scopeAdminListQuery(user, query) {
  if (isFieldTrainingAdmin(user)) return query;
  return query;
}

async function requireStudentUniversityId(studentId) {
  const uniId = await resolvePrimaryUniversityId({ userId: studentId });
  if (!uniId) {
    throw new ApiError(403, NO_UNIVERSITY_MSG, null, 'FIELD_TRAINING_STUDENT_UNIVERSITY_REQUIRED');
  }
  return uniId;
}

async function requireStudentSpecialtyId(studentId) {
  const specialtyId = await resolveStudentSpecialtyId({ userId: studentId });
  if (!specialtyId) {
    throw new ApiError(403, NO_SPECIALTY_MSG, null, 'FIELD_TRAINING_STUDENT_SPECIALTY_REQUIRED');
  }
  return specialtyId;
}

module.exports = {
  NO_UNIVERSITY_MSG,
  NO_SPECIALTY_MSG,
  requireStudentUniversityId,
  requireStudentSpecialtyId,
  scopeAdminListQuery,
  assertAdminOpportunityAccess,
  assertManageOpportunityAccess,
  isSystemWideAdmin,
  isFieldTrainingAdmin,
  isAssignedInstructor,
  canManageFieldTraining,
  manageOpportunityListWhere,
  normalizeRoles,
};
