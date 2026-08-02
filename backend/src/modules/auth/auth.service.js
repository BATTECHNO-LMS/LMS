const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { signToken } = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../../utils/emailDomain');
const authRepository = require('./auth.repository');
const { ensureUserLinkedToUniversityFromEmail } = require('./universityEmailLink.service');
const { recordAudit } = require('../../utils/auditRecorder');
const { notifyAdminsStudentRegistrationPending } = require('../../shared/services/notification.service');
const { emitDomainEvent } = require('../notificationEngine/notificationDispatcher.service');
const { listActiveSpecialties, assertActiveSpecialty } = require('../specialties/specialties.service');
const universitySpecialtiesService = require('../universitySpecialties/universitySpecialties.service');
const { issueEmailVerificationOtp, verifyEmailOtpForUser, resendEmailVerificationOtp } = require('./emailVerification.service');
const passwordResetService = require('./passwordReset.service');
const {
  normalizeRoleCodes,
  normalizeRoleRecords,
  pickPrimaryRoleCode,
  canonicalizeRoleCode,
  INSTITUTION_SCOPED_ROLE_CODES,
  UNIVERSITY_SCOPED_ROLE_CODES,
} = require('../../utils/roleCanon');
const { ALL_PERMISSION_CODES } = require('../../utils/permissionCatalog');
const {
  AUTH_ERROR_CODES,
  buildAccountGateDetails,
  messageForCode,
} = require('../../utils/authErrorCatalog');
const { evaluatePortalAccess, throwIfPortalMismatch } = require('./portalAccess');

function isGlobalFromRoleRecords(roleRecords) {
  const code = (env.SUPER_ADMIN_ROLE_CODE || 'super_admin').toLowerCase();
  return normalizeRoleRecords(roleRecords).some((r) => r.code.toLowerCase() === code);
}

function buildTokenPayload(userId, roleRecords, primaryUniversityId) {
  const roles = normalizeRoleCodes((roleRecords || []).map((r) => r.code));
  return {
    userId,
    roles,
    universityId: primaryUniversityId ?? null,
    isGlobal: isGlobalFromRoleRecords(roleRecords),
  };
}

async function toLoginUser(user, roleRecords, permissionCodes, isGlobal, options = {}) {
  const portalType = options.portalType || null;
  let primaryUniversityId = user.primary_university_id;
  let university = null;

  if (!primaryUniversityId) {
    university = await ensureUserLinkedToUniversityFromEmail(user.id, user.email);
    if (university) primaryUniversityId = university.id;
  } else {
    const row = await authRepository.findUniversityById(primaryUniversityId);
    university = row ? { id: row.id, name: row.name } : null;
  }

  const universitySpecialty = user.university_specialty
    ? {
        id: user.university_specialty.id,
        name_ar: user.university_specialty.name_ar,
        name_en: user.university_specialty.name_en,
        code: user.university_specialty.code,
        canonical_specialty_id: user.university_specialty.specialty_id,
      }
    : null;

  const canonicalSpecialty = user.specialties
    ? {
        id: user.specialties.id,
        name_ar: user.specialties.name_ar,
        name_en: user.specialties.name_en,
        code: user.specialties.code,
      }
    : null;

  const specialty =
    universitySpecialty ??
    (canonicalSpecialty
      ? {
          id: canonicalSpecialty.id,
          name_ar: canonicalSpecialty.name_ar,
          name_en: canonicalSpecialty.name_en,
          code: canonicalSpecialty.code,
          canonical_specialty_id: canonicalSpecialty.id,
        }
      : null);

  const roles = normalizeRoleCodes((roleRecords || []).map((r) => r.code));
  let role = pickPrimaryRoleCode((roleRecords || []).map((r) => r.code));

  const { prisma } = require('../../config/db');
  const assignmentRows = await prisma.user_organization_assignments.findMany({
    where: { user_id: user.id, is_active: true },
    orderBy: { assigned_at: 'desc' },
    include: {
      organizations: {
        select: { id: true, type: true, name: true, status: true, logo_url: true },
      },
      organization_branches: { select: { id: true, name: true } },
      organization_departments: { select: { id: true, name: true } },
    },
  });

  const organizationAssignments = assignmentRows.map((a) => ({
    id: a.id,
    organizationId: a.organization_id,
    organizationType: a.organizations?.type || null,
    organizationName: a.organizations?.name || '',
    organizationLogoUrl: a.organizations?.logo_url || null,
    roleCode: a.role_code,
    branchId: a.branch_id,
    branchName: a.organization_branches?.name || null,
    departmentId: a.department_id,
    departmentName: a.organization_departments?.name || null,
    jobTitle: a.job_title,
    isActive: a.is_active,
  }));

  const portalScopedRows = portalType
    ? assignmentRows.filter((a) => a.organizations?.type === portalType)
    : assignmentRows;

  const preferredOrganizationId = user.preferred_organization_id || null;
  let orgAssignment =
    (preferredOrganizationId &&
      portalScopedRows.find((a) => a.organization_id === preferredOrganizationId)) ||
    null;
  if (!orgAssignment && portalScopedRows.length === 1) {
    orgAssignment = portalScopedRows[0];
  } else if (!orgAssignment && portalScopedRows.length > 1 && !portalType) {
    // Provisional without portal context — frontend may force selection.
    orgAssignment = portalScopedRows[0];
  }

  const needsOrganizationSelection =
    !isGlobal && portalScopedRows.length > 1 && !orgAssignment;

  const organizationId = orgAssignment?.organization_id || university?.organization_id || null;
  const organizationType =
    orgAssignment?.organizations?.type || (primaryUniversityId ? 'UNIVERSITY' : null);
  const organization = orgAssignment?.organizations
    ? {
        id: orgAssignment.organizations.id,
        type: orgAssignment.organizations.type,
        name: orgAssignment.organizations.name,
        status: orgAssignment.organizations.status,
      }
    : null;

  // Portal-active role comes from the selected organization assignment when present.
  const assignmentRole = canonicalizeRoleCode(orgAssignment?.role_code);
  if (assignmentRole && (roles.includes(assignmentRole) || INSTITUTION_SCOPED_ROLE_CODES.includes(assignmentRole) || UNIVERSITY_SCOPED_ROLE_CODES.includes(assignmentRole))) {
    role = assignmentRole;
  } else if (organizationType === 'INSTITUTION' && roles.includes('trainee')) {
    role = 'trainee';
  } else if (organizationType === 'UNIVERSITY' && roles.includes('student')) {
    role = 'student';
  }

  const scope = isGlobal
    ? { type: 'global', universityId: null, organizationId: null }
    : organizationType === 'INSTITUTION' && organizationId
      ? { type: 'organization', universityId: null, organizationId }
      : primaryUniversityId
        ? { type: 'university', universityId: primaryUniversityId, organizationId }
        : { type: 'none', universityId: null, organizationId: null };

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    email_verified_at: user.email_verified_at ?? null,
    /** Official university scope source (alias of primary_university_id). */
    universityId: primaryUniversityId ?? null,
    primary_university_id: primaryUniversityId,
    primary_university: university,
    university,
    organizationId,
    organizationType,
    organization,
    preferredOrganizationId,
    needsOrganizationSelection,
    organizationAssignments,
    organizationAssignment: orgAssignment
      ? {
          id: orgAssignment.id,
          roleCode: orgAssignment.role_code,
          branchId: orgAssignment.branch_id,
          departmentId: orgAssignment.department_id,
          jobTitle: orgAssignment.job_title,
          employeeNumber: orgAssignment.employee_number,
        }
      : null,
    scope,
    university_specialty_id: user.university_specialty_id ?? null,
    specialty_id: user.specialty_id ?? null,
    specialty,
    university_specialty: universitySpecialty,
    canonical_specialty: canonicalSpecialty,
    roles,
    role,
    activeRole: role,
    permissions: isGlobal ? [...ALL_PERMISSION_CODES] : permissionCodes,
    isGlobal,
  };
}

async function listMyAssignments(userId) {
  const { prisma } = require('../../config/db');
  const user = await authRepository.findUserProfileById(userId);
  if (!user) {
    throw new ApiError(401, messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED), null, AUTH_ERROR_CODES.UNAUTHORIZED);
  }
  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(user.id);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  const profile = await toLoginUser(user, roleRecords, permissionCodes, isGlobal);
  return {
    preferredOrganizationId: profile.preferredOrganizationId,
    needsOrganizationSelection: profile.needsOrganizationSelection,
    assignments: profile.organizationAssignments,
  };
}

async function setActiveOrganization(userId, organizationId) {
  const { prisma } = require('../../config/db');
  const assignment = await prisma.user_organization_assignments.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      is_active: true,
    },
  });
  if (!assignment) {
    throw new ApiError(403, 'لا يمكنك تفعيل جهة غير مرتبطة بحسابك.');
  }
  await prisma.users.update({
    where: { id: userId },
    data: { preferred_organization_id: organizationId, updated_at: new Date() },
  });
  const user = await authRepository.findUserProfileById(userId);
  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(userId);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  return toLoginUser(user, roleRecords, permissionCodes, isGlobal);
}

async function registerInstitution(validated) {
  const { prisma } = require('../../config/db');
  const org = await prisma.organizations.findFirst({
    where: {
      id: validated.organization_id,
      type: 'INSTITUTION',
      status: 'active',
      allows_public_trainee_registration: true,
    },
  });
  if (!org) {
    throw new ApiError(404, 'المؤسسة المحددة غير موجودة أو غير متاحة للتسجيل العام.');
  }

  const branch = await prisma.organization_branches.findFirst({
    where: {
      id: validated.branch_id,
      organization_id: org.id,
      is_active: true,
    },
  });
  if (!branch) {
    throw new ApiError(400, 'الفرع المحدد غير صالح لهذه المؤسسة أو غير نشط.');
  }

  const existing = await authRepository.findUserByEmail(validated.email);
  if (existing) {
    throw new ApiError(
      409,
      messageForCode(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS),
      null,
      AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS
    );
  }

  const traineeRole = await authRepository.findRoleByCode('trainee');
  if (!traineeRole) {
    throw new ApiError(500, 'تعذر إكمال التسجيل حاليًا. يرجى المحاولة لاحقًا.');
  }

  const password_hash = await hashPassword(validated.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.users.create({
      data: {
        full_name: validated.full_name,
        email: validated.email,
        password_hash,
        phone: validated.phone,
        status: 'inactive',
        email_verified_at: null,
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        status: true,
        email_verified_at: true,
      },
    });
    await tx.user_roles.create({
      data: { user_id: created.id, role_id: traineeRole.id },
    });
    await tx.user_organization_assignments.create({
      data: {
        user_id: created.id,
        organization_id: org.id,
        role_code: 'trainee',
        branch_id: branch.id,
        is_active: true,
      },
    });
    return created;
  });

  await recordAudit({
    userId: null,
    organizationId: org.id,
    actionType: 'INSTITUTION_USER_REGISTERED',
    entityType: 'user',
    entityId: user.id,
    newValues: { email: user.email, organizationId: org.id },
  });

  await emitDomainEvent('ACCOUNT_PENDING_ACTIVATION', {
    affectedUserId: user.id,
    organizationId: org.id,
    entityType: 'user',
    entityId: user.id,
    templateVars: {
      student_name: user.full_name,
      email: user.email,
      action_url: '/institutions/login',
    },
  }).catch(() => null);

  await issueEmailVerificationOtp(user);

  return {
    requiresEmailVerification: true,
    email: user.email,
    pending_approval: true,
    portal: 'institutions',
  };
}

async function register(validated) {
  const university = await authRepository.findUniversityById(validated.university_id);
  if (!university) {
    throw new ApiError(
      404,
      messageForCode(AUTH_ERROR_CODES.UNIVERSITY_NOT_FOUND),
      null,
      AUTH_ERROR_CODES.UNIVERSITY_NOT_FOUND
    );
  }

  const domainsRows = await authRepository.findActiveEmailDomainsForUniversity(
    validated.university_id
  );
  const allowed = domainsRows.map((d) => d.domain);
  if (!allowed.length) {
    throw new ApiError(
      400,
      'لا يمكن إكمال التسجيل حاليًا لهذه الجامعة. يرجى التواصل مع الدعم.'
    );
  }

  const universitySpecialty = await universitySpecialtiesService.assertActiveUniversitySpecialtyForUniversity(
    validated.university_id,
    validated.university_specialty_id
  );

  let canonicalSpecialtyId = universitySpecialty.specialty_id ?? null;
  if (canonicalSpecialtyId) {
    await assertActiveSpecialty(canonicalSpecialtyId, {
      invalidMessage: 'التخصص المحدد غير متاح.',
    });
  }

  const emailDomain = extractEmailDomain(validated.email);
  if (!emailDomain || !emailDomainMatchesAllowed(emailDomain, allowed)) {
    throw new ApiError(
      400,
      messageForCode(AUTH_ERROR_CODES.EMAIL_DOMAIN_MISMATCH),
      null,
      AUTH_ERROR_CODES.EMAIL_DOMAIN_MISMATCH
    );
  }

  const existing = await authRepository.findUserByEmail(validated.email);
  if (existing) {
    throw new ApiError(
      409,
      messageForCode(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS),
      null,
      AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS
    );
  }
  if (validated.phone) {
    const phoneExisting = await authRepository.findUserByPhone(validated.phone);
    if (phoneExisting) {
      throw new ApiError(
        409,
        messageForCode(AUTH_ERROR_CODES.PHONE_ALREADY_EXISTS),
        null,
        AUTH_ERROR_CODES.PHONE_ALREADY_EXISTS
      );
    }
  }

  const studentRole = await authRepository.findRoleByCode(env.STUDENT_ROLE_CODE);
  if (!studentRole) {
    throw new ApiError(
      500,
      'تعذر إكمال التسجيل حاليًا. يرجى المحاولة لاحقًا.'
    );
  }

  const password_hash = await hashPassword(validated.password);

  const user = await authRepository.createStudentUser({
    full_name: validated.full_name,
    email: validated.email,
    password_hash,
    phone: validated.phone,
    university_id: validated.university_id,
    university_specialty_id: validated.university_specialty_id,
    specialty_id: canonicalSpecialtyId,
    studentRoleId: studentRole.id,
  });

  await recordAudit({
    userId: null,
    universityId: validated.university_id,
    actionType: 'USER_REGISTERED',
    entityType: 'user',
    entityId: user.id,
    newValues: { email: user.email, status: user.status, full_name: user.full_name },
  });

  await notifyAdminsStudentRegistrationPending({
    universityId: validated.university_id,
    studentEmail: user.email,
    studentName: user.full_name,
  });

  await emitDomainEvent('ACCOUNT_PENDING_ACTIVATION', {
    affectedUserId: user.id,
    studentId: user.id,
    universityId: validated.university_id,
    entityType: 'user',
    entityId: user.id,
    templateVars: {
      student_name: user.full_name,
      email: user.email,
      action_url: '/login/student',
    },
  }).catch(() => null);

  await issueEmailVerificationOtp(user);

  return {
    requiresEmailVerification: true,
    email: user.email,
    pending_approval: true,
  };
}

async function login(validated) {
  const user = await authRepository.findUserByEmail(validated.email);
  if (!user) {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.INVALID_CREDENTIALS),
      null,
      AUTH_ERROR_CODES.INVALID_CREDENTIALS
    );
  }

  const ok = await comparePassword(validated.password, user.password_hash);
  if (!ok) {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.INVALID_CREDENTIALS),
      null,
      AUTH_ERROR_CODES.INVALID_CREDENTIALS
    );
  }

  if (!user.email_verified_at) {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED),
      buildAccountGateDetails(user),
      AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED
    );
  }

  if (user.status === 'inactive') {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION),
      buildAccountGateDetails(user),
      AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION
    );
  }
  if (user.status === 'rejected') {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_REJECTED),
      buildAccountGateDetails(user),
      AUTH_ERROR_CODES.ACCOUNT_REJECTED
    );
  }
  if (user.status === 'suspended') {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_DISABLED),
      buildAccountGateDetails(user),
      AUTH_ERROR_CODES.ACCOUNT_DISABLED
    );
  }
  if (user.status !== 'active') {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_INACTIVE),
      buildAccountGateDetails(user),
      AUTH_ERROR_CODES.ACCOUNT_INACTIVE
    );
  }

  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(user.id);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  const { prisma } = require('../../config/db');
  const assignmentRows = await prisma.user_organization_assignments.findMany({
    where: { user_id: user.id, is_active: true },
    include: {
      organizations: { select: { id: true, type: true, status: true } },
    },
  });

  const portalEvaluation = evaluatePortalAccess(
    {
      assignments: assignmentRows,
      primaryUniversityId: user.primary_university_id,
      isGlobal,
    },
    validated.portalType
  );
  throwIfPortalMismatch(portalEvaluation);

  if (validated.portalType && !isGlobal && portalEvaluation.matchingOrganizationIds?.length) {
    const preferred = user.preferred_organization_id || null;
    const matching = portalEvaluation.matchingOrganizationIds;
    if (!preferred || !matching.includes(preferred)) {
      if (matching.length === 1) {
        await prisma.users.update({
          where: { id: user.id },
          data: { preferred_organization_id: matching[0], updated_at: new Date() },
        });
      } else if (preferred) {
        await prisma.users.update({
          where: { id: user.id },
          data: { preferred_organization_id: null, updated_at: new Date() },
        });
      }
    }
  }

  const profileUser = await authRepository.findUserProfileById(user.id);
  const profile = await toLoginUser(profileUser ?? user, roleRecords, permissionCodes, isGlobal, {
    portalType: validated.portalType || null,
  });
  const token = signToken(
    buildTokenPayload(user.id, roleRecords, profile.primary_university_id)
  );

  await authRepository.touchLastLogin(user.id);

  return {
    token,
    user: profile,
  };
}

async function me(userId) {
  const user = await authRepository.findUserProfileById(userId);
  if (!user) {
    throw new ApiError(401, messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED), null, AUTH_ERROR_CODES.UNAUTHORIZED);
  }
  if (user.status !== 'active') {
    throw new ApiError(
      403,
      messageForCode(AUTH_ERROR_CODES.ACCOUNT_INACTIVE),
      null,
      AUTH_ERROR_CODES.ACCOUNT_INACTIVE
    );
  }
  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(user.id);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  return toLoginUser(user, roleRecords, permissionCodes, isGlobal);
}

function logout() {
  return { message: 'Signed out successfully' };
}

async function universitiesForRegistration() {
  const universities = await authRepository.findActiveUniversitiesForRegistration();
  return { universities };
}

async function specialtiesForRegistration() {
  return listActiveSpecialties();
}

async function universitySpecialtiesForRegistration(universityId) {
  return universitySpecialtiesService.listActiveForUniversity(universityId);
}

async function verifyEmailOtp(validated) {
  const result = await verifyEmailOtpForUser(validated.email, validated.otp);
  if (result.alreadyVerified) {
    return {
      emailVerified: true,
      requiresAdminApproval: result.requiresAdminApproval,
      alreadyVerified: true,
    };
  }
  return {
    emailVerified: true,
    requiresAdminApproval: result.requiresAdminApproval,
  };
}

async function resendEmailOtp(validated) {
  return resendEmailVerificationOtp(validated.email);
}

async function forgotPassword(validated) {
  return passwordResetService.requestPasswordReset(validated.email);
}

async function verifyPasswordResetOtp(validated) {
  return passwordResetService.verifyPasswordResetOtp(validated.email, validated.otp);
}

async function resendPasswordResetOtp(validated) {
  return passwordResetService.resendPasswordResetOtp(validated.email);
}

async function resetPassword(validated) {
  return passwordResetService.resetPasswordWithToken({
    email: validated.email,
    resetToken: validated.resetToken,
    newPassword: validated.newPassword,
  });
}

async function accountStatus(validated) {
  const user = await authRepository.findUserByEmail(validated.email);
  if (!user) {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.INVALID_CREDENTIALS),
      null,
      AUTH_ERROR_CODES.INVALID_CREDENTIALS
    );
  }
  const ok = await comparePassword(validated.password, user.password_hash);
  if (!ok) {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.INVALID_CREDENTIALS),
      null,
      AUTH_ERROR_CODES.INVALID_CREDENTIALS
    );
  }
  const details = buildAccountGateDetails(user);
  let code = AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION;
  if (!user.email_verified_at) code = AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED;
  else if (user.status === 'rejected') code = AUTH_ERROR_CODES.ACCOUNT_REJECTED;
  else if (user.status === 'suspended') code = AUTH_ERROR_CODES.ACCOUNT_DISABLED;
  else if (user.status === 'active') code = 'ACCOUNT_ACTIVE';
  return {
    code,
    emailMasked: details.maskedEmail,
    emailVerified: details.emailVerified,
    accountStatus: user.status,
    createdAt: details.createdAt,
    emailVerifiedAt: details.emailVerifiedAt,
    hoursPending: details.hoursPending,
    overdue48h: details.overdue48h,
    expectedWithinHours: details.expectedWithinHours,
  };
}

module.exports = {
  register,
  registerInstitution,
  login,
  me,
  listMyAssignments,
  setActiveOrganization,
  logout,
  universitiesForRegistration,
  specialtiesForRegistration,
  universitySpecialtiesForRegistration,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
  accountStatus,
  /** Exported for characterization tests — same helpers used at login. */
  isGlobalFromRoleRecords,
  buildTokenPayload,
};
