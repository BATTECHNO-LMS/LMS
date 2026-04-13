import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchCorrectiveActionsList(params = {}) {
  const res = await apiClient.get(endpoints.correctiveActions, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.corrective_actions)) {
    throw new Error('Invalid corrective actions list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchCorrectiveActionById(id) {
  const res = await apiClient.get(`${endpoints.correctiveActions}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createCorrectiveAction(body) {
  const res = await apiClient.post(endpoints.correctiveActions, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateCorrectiveAction(id, body) {
  const res = await apiClient.put(`${endpoints.correctiveActions}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchCorrectiveActionStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.correctiveActions}/${id}/status`, body);
  return unwrapApiData(res);
}
