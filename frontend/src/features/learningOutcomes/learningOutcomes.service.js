import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

function nestedListUrl(microCredentialId) {
  return `${endpoints.microCredentials}/${microCredentialId}/learning-outcomes`;
}

/**
 * @param {string} microCredentialId
 */
export async function fetchLearningOutcomesByMicroCredential(microCredentialId) {
  const res = await apiClient.get(nestedListUrl(microCredentialId));
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.learning_outcomes)) {
    throw new Error('Invalid learning outcomes response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchLearningOutcomeById(id) {
  const res = await apiClient.get(`${endpoints.learningOutcomes}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} microCredentialId
 * @param {Record<string, unknown>} body
 */
export async function createLearningOutcome(microCredentialId, body) {
  const res = await apiClient.post(nestedListUrl(microCredentialId), body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateLearningOutcome(id, body) {
  const res = await apiClient.put(`${endpoints.learningOutcomes}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 */
export async function deleteLearningOutcome(id) {
  const res = await apiClient.delete(`${endpoints.learningOutcomes}/${id}`);
  return unwrapApiData(res);
}
