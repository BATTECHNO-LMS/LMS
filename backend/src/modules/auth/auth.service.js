const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { signToken } = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../../utils/emailDomain');
const authRepository = require('./auth.repository');
const { ensureUserLinkedToUniversityFromEmail } = require('./universityEmailLink.service');
const { recordAudit } = require('../../utils/auditRecorder');
const { notifyAdminsStudentRegistrationPending } = require('../../shared/services/notification.service');
const { listActiveSpecialties, assertActiveSpecialty } = require('../specialties/specialties.service');
const universitySpecialtiesService = require('../universitySpecialties/universitySpecialties.service');
const { issueEmailVerificationOtp, verifyEmailOtpForUser, resendEmailVerificationOtp } = require('./emailVerification.service');
const passwordResetService = require('./passwordReset.service');
const { normalizeRoleCodes, normalizeRoleRecords, pickPrimaryRoleCode } = require('../../utils/roleCanon');
const { ALL_PERMISSION_CODES } = require('../../utils/permissionCatalog');

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

async function toLoginUser(user, roleRecords, permissionCodes, isGlobal) {
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
  const role = pickPrimaryRoleCode((roleRecords || []).map((r) => r.code));
  const scope = isGlobal
    ? { type: 'global', universityId: null }
    : primaryUniversityId
      ? { type: 'university', universityId: primaryUniversityId }
      : { type: 'none', universityId: null };

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    /** Official university scope source (alias of primary_university_id). */
    universityId: primaryUniversityId ?? null,
    primary_university_id: primaryUniversityId,
    primary_university: university,
    university,
    scope,
    university_specialty_id: user.university_specialty_id ?? null,
    specialty_id: user.specialty_id ?? null,
    specialty,
    university_specialty: universitySpecialty,
    canonical_specialty: canonicalSpecialty,
    roles,
    role,
    permissions: isGlobal ? [...ALL_PERMISSION_CODES] : permissionCodes,
    isGlobal,
  };
}

async function register(validated) {
  const university = await authRepository.findUniversityById(validated.university_id);
  if (!university) {
    throw new ApiError(404, 'University not found');
  }

  const domainsRows = await authRepository.findActiveEmailDomainsForUniversity(
    validated.university_id
  );
  const allowed = domainsRows.map((d) => d.domain);
  if (!allowed.length) {
    throw new ApiError(
      400,
      'No active email domains configured for this university. Contact the administrator.'
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
      'Email address does not match the selected university mail domains'
    );
  }

  const existing = await authRepository.findUserByEmail(validated.email);
  if (existing) {
    throw new ApiError(409, 'Email already exists');
  }

  const studentRole = await authRepository.findRoleByCode(env.STUDENT_ROLE_CODE);
  if (!studentRole) {
    throw new ApiError(
      500,
      `Student role "${env.STUDENT_ROLE_CODE}" is missing from the roles table`
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
    throw new ApiError(401, 'Invalid credentials');
  }

  const ok = await comparePassword(validated.password, user.password_hash);
  if (!ok) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.email_verified_at) {
    throw new ApiError(
      403,
      'يرجى توثيق البريد الإلكتروني قبل تسجيل الدخول.',
      null,
      'EMAIL_NOT_VERIFIED'
    );
  }

  if (user.status === 'inactive') {
    throw new ApiError(403, 'حسابك بانتظار تفعيل الإدارة.', null, 'ACCOUNT_PENDING_ACTIVATION');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'الحساب غير مفعل أو موقوف.', null, 'ACCOUNT_INACTIVE');
  }

  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(user.id);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  const profileUser = await authRepository.findUserProfileById(user.id);
  const profile = await toLoginUser(profileUser ?? user, roleRecords, permissionCodes, isGlobal);
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
    throw new ApiError(401, 'Unauthorized');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'Account is inactive or suspended');
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

module.exports = {
  register,
  login,
  me,
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
  /** Exported for characterization tests — same helpers used at login. */
  isGlobalFromRoleRecords,
  buildTokenPayload,
};
