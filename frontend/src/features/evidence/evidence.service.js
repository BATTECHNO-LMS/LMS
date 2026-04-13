import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchEvidenceList(params = {}) {
  const res = await apiClient.get(endpoints.evidence, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.evidence)) {
    throw new Error('Invalid evidence list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchEvidenceById(id) {
  const res = await apiClient.get(`${endpoints.evidence}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createEvidence(body) {
  const res = await apiClient.post(endpoints.evidence, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateEvidence(id, body) {
  const res = await apiClient.put(`${endpoints.evidence}/${id}`, body);
  return unwrapApiData(res);
}
