import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function fetchUsersList(params = {}) {
  const res = await apiClient.get(endpoints.users, { params });
  return unwrapApiData(res);
}

/**
 * @param {string} id
 */
export async function fetchUserById(id) {
  const res = await apiClient.get(`${endpoints.users}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createUser(body) {
  const res = await apiClient.post(endpoints.users, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateUser(id, body) {
  const res = await apiClient.put(`${endpoints.users}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchUserStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.users}/${id}/status`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 */
export async function activateUserAccount(id) {
  const res = await apiClient.patch(`${endpoints.users}/${id}/activate`);
  return unwrapApiData(res);
}

/**
 * Activate all inactive student accounts (optional university scope).
 * @param {{ university_id?: string, user_ids?: string[] }} [params]
 */
export async function activateAllPendingUsers({ university_id, user_ids } = {}) {
  const params = {};
  if (university_id) params.university_id = university_id;
  const body = user_ids?.length ? { user_ids } : {};
  const res = await apiClient.post(`${endpoints.users}/activate-pending`, body, {
    params,
    timeout: 120000,
  });
  return unwrapApiData(res);
}

/**
 * Manually verify a single user's email (does not activate the account).
 * @param {string} id
 */
export async function verifyUserEmail(id) {
  const res = await apiClient.post(`${endpoints.users}/${id}/verify-email`);
  return unwrapApiData(res);
}

/**
 * Bulk-verify emails for unverified users in current admin scope/filters.
 * @param {{ university_id?: string, status?: string, user_ids?: string[] }} [params]
 */
export async function verifyAllUserEmails({ university_id, status, user_ids } = {}) {
  const params = {};
  if (university_id) params.university_id = university_id;
  if (status) params.status = status;
  const body = user_ids?.length ? { user_ids } : {};
  const res = await apiClient.post(`${endpoints.users}/verify-all-emails`, body, {
    params,
    timeout: 120000,
  });
  return unwrapApiData(res);
}

/**
 * Verify selected user emails only.
 * @param {string[]} userIds
 */
export async function bulkVerifyUserEmails(userIds) {
  const res = await apiClient.post(`${endpoints.users}/bulk-verify-emails`, { userIds });
  return unwrapApiData(res);
}

/**
 * Admin reset user password (hashed on server).
 * @param {string} id
 * @param {{ new_password: string, confirm_password: string }} body
 */
export async function adminResetUserPassword(id, body) {
  const res = await apiClient.post(`${endpoints.users}/${id}/reset-password`, body);
  return unwrapApiData(res);
}
