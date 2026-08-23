const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const {
  resolvePrimaryUniversityId,
  resolveStudentSpecialtyId,
  resolveStudentUniversitySpecialtyId,
  resolveStudentFieldTrainingScope,
} = require('../../utils/studentScope');
const {
  isSystemWideAdmin,
  resolveUniversityIdFilter,
  assertUniversityRecordAccess,
  denyAllWhere,
} = require('../../utils/universityScope');
const ftEligibility = require('./fieldTraining.eligibility');

const NO_UNIVERSITY_MSG = 'يرجى استكمال بيانات الجامعة والتخصص لعرض فرص التدريب المناسبة.';
const NO_SPECIALTY_MSG = 'يرجى استكمال بيانات الجامعة والتخصص لعرض فرص التدريب المناسبة.';
const NO_UNIVERSITY_SPECIALTY_MSG =
  'يرجى استكمال بيانات الجامعة والتخصص لعرض فرص التدريب المناسبة.';
const NOT_ELIGIBLE_MSG = 'هذه الفرصة غير متاحة للجامعة أو التخصص المسجل في حسابك.';
const UNIVERSITY_FORBIDDEN_MSG = 'غير مصرح بالوصول إلى بيانات طلاب جامعة أخرى';
const STUDENT_INACTIVE_MSG = 'حسابك غير مفعّل. لا يمكن عرض فرص التدريب حتى يتم تفعيل الحساب.';

const UNIVERSITY_SCOPED_FT_ROLES = ['admin', 'reviewer'];

function normalizeRoles(user) {
  const { normalizeRoleCodes } = require('../../utils/roleCanon');
  return normalizeRoleCodes(user?.roles || []);
}

function isFieldTrainingAdmin(user) {
  if (isSystemWideAdmin(user)) return true;
  const roles = normalizeRoles(user);
  return roles.some((r) => env.FIELD_TRAINING_ADMIN_ROLE_CODES.includes(r));
}

function isUniversityScopedFieldTrainingUser(user) {
  if (isSystemWideAdmin(user)) return false;
  if (!user?.universityId) return false;
  const roles = normalizeRoles(user);
  return (
    roles.some((r) => UNIVERSITY_SCOPED_FT_ROLES.includes(r)) ||
    roles.some((r) => env.FIELD_TRAINING_ADMIN_ROLE_CODES.includes(r))
  );
}

function isAssignedInstructor(user, opportunity) {
  if (!user?.userId || !opportunity?.assigned_instructor_id) return false;
  const roles = normalizeRoles(user);
  if (!roles.includes('instructor')) return false;
  return String(opportunity.assigned_instructor_id) === String(user.userId);
}

function opportunityEligibilityWhereForUniversity(universityId) {
  return {
    field_training_opportunity_eligibility: {
      some: { is_active: true, university_id: universityId },
    },
  };
}

function canManageFieldTraining(user, opportunity) {
  if (isSystemWideAdmin(user)) return true;
  if (isAssignedInstructor(user, opportunity)) return true;
  return isFieldTrainingAdmin(user);
}

async function assertAdminOpportunityAccess(user, opportunity) {
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  if (isSystemWideAdmin(user)) return;
  if (isAssignedInstructor(user, opportunity)) return;
  if (!isFieldTrainingAdmin(user)) {
    throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
  }
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, 'غير مصرح', null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if (opportunity.university_id) {
    assertUniversityRecordAccess(user, opportunity.university_id);
    return;
  }
  const allowed = await ftEligibility.hasActiveEligibilityForUniversity(opportunity.id, uni);
  if (!allowed) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى هذه الفرصة', null, 'FIELD_TRAINING_FORBIDDEN');
  }
}

async function assertManageOpportunityAccess(user, opportunity) {
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  if (!canManageFieldTraining(user, opportunity)) {
    throw new ApiError(403, 'غير مصرح بإدارة هذه الفرصة', null, 'FIELD_TRAINING_FORBIDDEN');
  }
  await assertAdminOpportunityAccess(user, opportunity);
}

function assertStudentUniversityAccess(user, studentPrimaryUniversityId) {
  if (isSystemWideAdmin(user)) return;
  const uni = user?.universityId;
  if (!uni || !isUniversityScopedFieldTrainingUser(user)) return;
  if (!studentPrimaryUniversityId || String(studentPrimaryUniversityId) !== String(uni)) {
    throw new ApiError(403, UNIVERSITY_FORBIDDEN_MSG, null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
}

async function assertApplicationStudentAccess(user, studentId) {
  if (isSystemWideAdmin(user)) return;
  if (!isUniversityScopedFieldTrainingUser(user)) return;
  const student = await prisma.users.findUnique({
    where: { id: studentId },
    select: { primary_university_id: true },
  });
  assertStudentUniversityAccess(user, student?.primary_university_id ?? null);
}

function resolveApplicationStudentUniversityId(user, requestedUniversityId) {
  return resolveUniversityIdFilter(user, requestedUniversityId);
}

function manageOpportunityListWhere(user) {
  if (isSystemWideAdmin(user)) return {};

  const roles = normalizeRoles(user);
  const uni = user?.universityId;

  if (isFieldTrainingAdmin(user)) {
    if (uni) return opportunityEligibilityWhereForUniversity(uni);
    return denyAllWhere();
  }

  // Assigned instructors see all opportunities they own — do not scope by university eligibility.
  if (roles.includes('instructor') && user?.userId) {
    return { assigned_instructor_id: user.userId };
  }

  return denyAllWhere();
}

function scopeAdminListQuery(user, query) {
  if (isSystemWideAdmin(user)) return query;
  const universityId = resolveUniversityIdFilter(user, query.university_id);
  if (!universityId) {
    return { ...query, university_id: '00000000-0000-0000-0000-000000000000' };
  }
  return { ...query, university_id: universityId };
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

async function requireStudentUniversitySpecialtyId(studentId) {
  const universitySpecialtyId = await resolveStudentUniversitySpecialtyId({ userId: studentId });
  if (!universitySpecialtyId) {
    throw new ApiError(
      403,
      NO_UNIVERSITY_SPECIALTY_MSG,
      null,
      'FIELD_TRAINING_STUDENT_UNIVERSITY_SPECIALTY_REQUIRED'
    );
  }
  return universitySpecialtyId;
}

async function requireStudentFieldTrainingScope(studentId) {
  const scope = await resolveStudentFieldTrainingScope({ userId: studentId });
  if (scope.accountStatus && scope.accountStatus !== 'active') {
    throw new ApiError(403, STUDENT_INACTIVE_MSG, null, 'FIELD_TRAINING_STUDENT_INACTIVE');
  }
  if (!scope.universityId) {
    throw new ApiError(403, NO_UNIVERSITY_MSG, null, 'FIELD_TRAINING_STUDENT_UNIVERSITY_REQUIRED');
  }
  if (!scope.universitySpecialtyId) {
    throw new ApiError(
      403,
      NO_UNIVERSITY_SPECIALTY_MSG,
      null,
      'FIELD_TRAINING_STUDENT_UNIVERSITY_SPECIALTY_REQUIRED'
    );
  }
  return scope;
}

module.exports = {
  NO_UNIVERSITY_MSG,
  NO_SPECIALTY_MSG,
  NO_UNIVERSITY_SPECIALTY_MSG,
  NOT_ELIGIBLE_MSG,
  UNIVERSITY_FORBIDDEN_MSG,
  STUDENT_INACTIVE_MSG,
  requireStudentUniversityId,
  requireStudentSpecialtyId,
  requireStudentUniversitySpecialtyId,
  requireStudentFieldTrainingScope,
  scopeAdminListQuery,
  assertAdminOpportunityAccess,
  assertManageOpportunityAccess,
  assertStudentUniversityAccess,
  assertApplicationStudentAccess,
  resolveApplicationStudentUniversityId,
  isSystemWideAdmin,
  isFieldTrainingAdmin,
  isUniversityScopedFieldTrainingUser,
  isAssignedInstructor,
  canManageFieldTraining,
  manageOpportunityListWhere,
  normalizeRoles,
};

