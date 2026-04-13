import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{
 *   university_id?: string,
 *   micro_credential_id?: string,
 *   cohort_id?: string,
 *   status?: string,
 *   search?: string,
 * }} [params]
 */
export async function fetchRecognitionRequestsList(params = {}) {
  const res = await apiClient.get(endpoints.recognitionRequests, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.recognition_requests)) {
    throw new Error('Invalid recognition requests list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchRecognitionRequestById(id) {
  const res = await apiClient.get(`${endpoints.recognitionRequests}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createRecognitionRequest(body) {
  const res = await apiClient.post(endpoints.recognitionRequests, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateRecognitionRequest(id, body) {
  const res = await apiClient.put(`${endpoints.recognitionRequests}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchRecognitionRequestStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.recognitionRequests}/${id}/status`, body);
  return unwrapApiData(res);
}
