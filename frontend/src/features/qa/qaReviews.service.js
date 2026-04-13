import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchQaReviewsList(params = {}) {
  const res = await apiClient.get(endpoints.qaReviews, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.qa_reviews)) {
    throw new Error('Invalid QA reviews list response');
  }
  return data;
}

/**
 * @param {string} id
 * @param {{ include_corrective?: boolean }} [opts]
 */
export async function fetchQaReviewById(id, opts = {}) {
  const params = {};
  if (opts.include_corrective) params.include_corrective = 'true';
  const res = await apiClient.get(`${endpoints.qaReviews}/${id}`, { params });
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createQaReview(body) {
  const res = await apiClient.post(endpoints.qaReviews, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateQaReview(id, body) {
  const res = await apiClient.put(`${endpoints.qaReviews}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchQaReviewStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.qaReviews}/${id}/status`, body);
  return unwrapApiData(res);
}
