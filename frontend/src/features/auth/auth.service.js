import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { mapAuthUser } from './authUserMapper.js';

/**
 * @param {{ email: string, password: string }} credentials
 */
export async function login(credentials) {
  const { email, password } = credentials;
  const res = await apiClient.post(endpoints.auth.login, { email, password });
  const payload = unwrapApiData(res);
  const token = payload?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid login response: missing token');
  }
  return { data: { token } };
}

/**
 * Student self-registration (backend validates email domain per university).
 * @param {{ full_name: string, email: string, password: string, university_id: string, phone?: string }} body
 */
export async function registerStudent(body) {
  const res = await apiClient.post(endpoints.auth.register, body);
  const payload = unwrapApiData(res);
  const token = payload?.token;
  if (token && typeof token === 'string') {
    return { data: { token } };
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
