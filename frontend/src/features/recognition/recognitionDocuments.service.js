import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {string} recognitionRequestId
 */
export async function fetchRecognitionDocumentsForRequest(recognitionRequestId) {
  const res = await apiClient.get(`${endpoints.recognitionRequests}/${recognitionRequestId}/documents`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.recognition_documents)) {
    throw new Error('Invalid recognition documents list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchRecognitionDocumentById(id) {
  const res = await apiClient.get(`${endpoints.recognitionDocuments}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} recognitionRequestId
 * @param {Record<string, unknown>} body
 */
export async function createRecognitionDocument(recognitionRequestId, body) {
  const res = await apiClient.post(`${endpoints.recognitionRequests}/${recognitionRequestId}/documents`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateRecognitionDocument(id, body) {
  const res = await apiClient.put(`${endpoints.recognitionDocuments}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 */
export async function deleteRecognitionDocument(id) {
  const res = await apiClient.delete(`${endpoints.recognitionDocuments}/${id}`);
  return unwrapApiData(res);
}
