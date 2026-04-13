import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchAssessmentsList(params = {}) {
  const res = await apiClient.get(endpoints.assessments, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.assessments)) {
    throw new Error('Invalid assessments list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchAssessmentById(id) {
  const res = await apiClient.get(`${endpoints.assessments}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createAssessment(body) {
  const res = await apiClient.post(endpoints.assessments, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateAssessment(id, body) {
  const res = await apiClient.put(`${endpoints.assessments}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchAssessmentStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.assessments}/${id}/status`, body);
  return unwrapApiData(res);
}
