import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {string} cohortId
 */
export async function fetchEnrollmentsByCohort(cohortId) {
  const res = await apiClient.get(`${endpoints.cohorts}/${cohortId}/enrollments`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.enrollments)) {
    throw new Error('Invalid enrollments response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchEnrollmentById(id) {
  const res = await apiClient.get(`${endpoints.enrollments}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} cohortId
 * @param {{ student_id: string }} body
 */
export async function createEnrollment(cohortId, body) {
  const res = await apiClient.post(`${endpoints.cohorts}/${cohortId}/enrollments`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function patchEnrollmentStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.enrollments}/${id}/status`, body);
  return unwrapApiData(res);
}
