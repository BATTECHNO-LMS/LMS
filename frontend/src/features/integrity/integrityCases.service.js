import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchIntegrityCasesList(params = {}) {
  const res = await apiClient.get(endpoints.integrityCases, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.integrity_cases)) {
    throw new Error('Invalid integrity cases list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchIntegrityCaseById(id) {
  const res = await apiClient.get(`${endpoints.integrityCases}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createIntegrityCase(body) {
  const res = await apiClient.post(endpoints.integrityCases, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateIntegrityCase(id, body) {
  const res = await apiClient.put(`${endpoints.integrityCases}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchIntegrityCaseStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.integrityCases}/${id}/status`, body);
  return unwrapApiData(res);
}
