import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{
 *   status?: string,
 *   university_id?: string,
 *   micro_credential_id?: string,
 *   instructor_id?: string,
 *   search?: string,
 * }} [params]
 */
export async function fetchCohortsList(params = {}) {
  const res = await apiClient.get(endpoints.cohorts, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.cohorts)) {
    throw new Error('Invalid cohorts list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchCohortById(id) {
  const res = await apiClient.get(`${endpoints.cohorts}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createCohort(body) {
  const res = await apiClient.post(endpoints.cohorts, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateCohort(id, body) {
  const res = await apiClient.put(`${endpoints.cohorts}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchCohortStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.cohorts}/${id}/status`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} cohortId
 */
export async function fetchCohortAttendanceSummary(cohortId) {
  const res = await apiClient.get(`${endpoints.cohorts}/${cohortId}/attendance-summary`);
  return unwrapApiData(res);
}
