import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @returns {Promise<{ universities: object[] }>}
 */
export async function fetchUniversitiesList() {
  const res = await apiClient.get(endpoints.universities);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.universities)) {
    throw new Error('Invalid universities list response');
  }
  return { universities: data.universities };
}

/**
 * @param {string} id
 */
export async function fetchUniversityById(id) {
  const res = await apiClient.get(`${endpoints.universities}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createUniversity(body) {
  const res = await apiClient.post(endpoints.universities, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateUniversity(id, body) {
  const res = await apiClient.put(`${endpoints.universities}/${id}`, body);
  return unwrapApiData(res);
}
