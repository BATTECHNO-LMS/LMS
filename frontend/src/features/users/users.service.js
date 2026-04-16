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
