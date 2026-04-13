import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, string | undefined>} [params] — track_id, status, internal_approval_status, search
 */
export async function fetchMicroCredentialsList(params = {}) {
  const res = await apiClient.get(endpoints.microCredentials, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.micro_credentials)) {
    throw new Error('Invalid micro-credentials list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchMicroCredentialById(id) {
  const res = await apiClient.get(`${endpoints.microCredentials}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createMicroCredential(body) {
  const res = await apiClient.post(endpoints.microCredentials, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateMicroCredential(id, body) {
  const res = await apiClient.put(`${endpoints.microCredentials}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchMicroCredentialStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.microCredentials}/${id}/status`, body);
  return unwrapApiData(res);
}
