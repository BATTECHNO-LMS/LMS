const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { signToken } = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../../utils/emailDomain');
const authRepository = require('./auth.repository');

function isGlobalFromRoleRecords(roleRecords) {
  const code = (env.SUPER_ADMIN_ROLE_CODE || 'super_admin').toLowerCase();
  return roleRecords.some((r) => r.code.toLowerCase() === code);
}

function buildTokenPayload(userId, roleRecords, primaryUniversityId) {
  return {
    userId,
    roles: roleRecords.map((r) => r.code),
    universityId: primaryUniversityId ?? null,
    isGlobal: isGlobalFromRoleRecords(roleRecords),
  };
}

function toLoginUser(user, roleRecords, permissionCodes, isGlobal) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    primary_university_id: user.primary_university_id,
    roles: roleRecords.map((r) => r.code),
    permissions: permissionCodes,
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
    studentRoleId: studentRole.id,
  });

  const roleRecords = [studentRole];
  const token = signToken(
    buildTokenPayload(user.id, roleRecords, user.primary_university_id)
  );

  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      roles: roleRecords.map((r) => r.code),
      primary_university_id: user.primary_university_id,
    },
  };
}

async function login(validated) {
  const user = await authRepository.findUserByEmail(validated.email);
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'Account is inactive or suspended');
  }

  const ok = await comparePassword(validated.password, user.password_hash);
  if (!ok) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const { roleRecords, permissionCodes } = await authRepository.loadRolesAndPermissions(user.id);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);
  const token = signToken(
    buildTokenPayload(user.id, roleRecords, user.primary_university_id)
  );

  await authRepository.touchLastLogin(user.id);

  return {
    token,
    user: toLoginUser(user, roleRecords, permissionCodes, isGlobal),
  };
}

async function me(userId) {
  const user = await authRepository.findUserById(userId);
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

module.exports = { register, login, me, logout, universitiesForRegistration };
