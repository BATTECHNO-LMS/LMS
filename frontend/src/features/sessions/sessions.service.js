import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {string} cohortId
 */
export async function fetchSessionsByCohort(cohortId) {
  const res = await apiClient.get(`${endpoints.cohorts}/${cohortId}/sessions`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.sessions)) {
    throw new Error('Invalid sessions response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchSessionById(id) {
  const res = await apiClient.get(`${endpoints.sessions}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} cohortId
 * @param {Record<string, unknown>} body
 */
export async function createSession(cohortId, body) {
  const res = await apiClient.post(`${endpoints.cohorts}/${cohortId}/sessions`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateSession(id, body) {
  const res = await apiClient.put(`${endpoints.sessions}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ documentation_status: string }} body
 */
export async function patchSessionDocumentationStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.sessions}/${id}/documentation-status`, body);
  return unwrapApiData(res);
}
