import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { mapAuthUser } from './authUserMapper.js';

/**
 * @param {{ email: string, password: string, portalType?: 'UNIVERSITY'|'INSTITUTION' }} credentials
 */
export async function login(credentials) {
  const { email, password, portalType } = credentials;
  const body = { email, password };
  if (portalType === 'UNIVERSITY' || portalType === 'INSTITUTION') {
    body.portalType = portalType;
  }
  const res = await apiClient.post(endpoints.auth.login, body);
  const payload = unwrapApiData(res);
  const token = payload?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid login response: missing token');
  }
  return { data: { token } };
}

export async function fetchMyAssignments() {
  const res = await apiClient.get(endpoints.auth.myAssignments);
  return unwrapApiData(res);
}

/**
 * Persist preferred active organization (validated server-side).
 * @param {string} organizationId
 */
export async function setActiveOrganization(organizationId) {
  const res = await apiClient.post(endpoints.auth.activeOrganization, {
    organization_id: organizationId,
  });
  const payload = unwrapApiData(res);
  const user = mapAuthUser(payload?.user ?? payload);
  if (!user) {
    throw new Error('Invalid active organization response');
  }
  return { data: { user } };
}

export async function fetchAccountStatus(credentials) {
  const { email, password } = credentials;
  const res = await apiClient.post(endpoints.auth.accountStatus, { email, password });
  return unwrapApiData(res);
}

/**
 * Student self-registration (backend validates email domain per university).
 * @param {{ full_name: string, email: string, password: string, university_id: string, university_specialty_id: string, phone?: string }} body
 */
export async function registerStudent(body) {
  const res = await apiClient.post(endpoints.auth.register, body);
  const payload = unwrapApiData(res);
  const token = payload?.token;
  if (token && typeof token === 'string') {
    return { data: { token } };
  }
  if (payload?.requiresEmailVerification) {
    return {
      data: {
        requiresEmailVerification: true,
        email: payload.email ?? body.email,
        pending_approval: payload.pending_approval ?? true,
      },
    };
  }
  if (payload?.pending_approval) {
    return {
      data: {
        pending_approval: true,
        user: payload.user ?? null,
      },
    };
  }
  throw new Error('Invalid registration response');
}

/**
 * @param {string} email
 * @param {string} otp
 */
export async function verifyEmailOtp(email, otp) {
  const res = await apiClient.post(endpoints.auth.verifyEmailOtp, { email, otp });
  return unwrapApiData(res);
}

/**
 * @param {string} email
 */
export async function resendEmailOtp(email) {
  const res = await apiClient.post(endpoints.auth.resendEmailOtp, { email });
  const body = res?.data;
  if (body && typeof body === 'object' && body.success === true) {
    return { message: body.message ?? '' };
  }
  throw new Error('Invalid resend response');
}

export async function forgotPassword(email) {
  const res = await apiClient.post(endpoints.auth.forgotPassword, { email });
  const body = res?.data;
  if (body && typeof body === 'object' && body.success === true) {
    return { message: body.message ?? '' };
  }
  throw new Error('Invalid forgot password response');
}

export async function verifyPasswordResetOtp(email, otp) {
  const res = await apiClient.post(endpoints.auth.verifyPasswordResetOtp, { email, otp });
  return unwrapApiData(res);
}

export async function resendPasswordResetOtp(email) {
  const res = await apiClient.post(endpoints.auth.resendPasswordResetOtp, { email });
  const body = res?.data;
  if (body && typeof body === 'object' && body.success === true) {
    return { message: body.message ?? '' };
  }
  throw new Error('Invalid resend password reset response');
}

export async function resetPassword(email, resetToken, newPassword, confirmPassword) {
  const res = await apiClient.post(endpoints.auth.resetPassword, {
    email,
    resetToken,
    newPassword,
    confirmPassword,
  });
  const body = res?.data;
  if (body && typeof body === 'object' && body.success === true) {
    return { message: body.message ?? '' };
  }
  throw new Error('Invalid reset password response');
}

export async function logout() {
  try {
    await apiClient.post(endpoints.auth.logout);
  } catch {
    /* still clear client session */
  }
  return { data: {} };
}

export async function fetchCurrentUser() {
  const res = await apiClient.get(endpoints.auth.me);
  const payload = unwrapApiData(res);
  const user = mapAuthUser(payload?.user);
  if (!user) {
    const err = new Error('Invalid profile response');
    err.code = 'PROFILE_INVALID';
    throw err;
  }
  return { data: { user } };
}

/** Public catalog for student registration (no JWT). */
export async function fetchRegisterUniversitiesCatalog() {
  const res = await apiClient.get(endpoints.auth.registerUniversities);
  const payload = unwrapApiData(res);
  const list = payload?.universities;
  if (!Array.isArray(list)) {
    throw new Error('Invalid universities catalog response');
  }
  return list;
}

/**
 * Active university-specific specialties for registration (no JWT).
 * @param {string} universityId
 */
export async function fetchRegisterUniversitySpecialties(universityId) {
  const res = await apiClient.get(endpoints.auth.registerUniversitySpecialties(universityId));
  const payload = unwrapApiData(res);
  if (!Array.isArray(payload)) {
    throw new Error('Invalid university specialties catalog response');
  }
  return payload;
}
