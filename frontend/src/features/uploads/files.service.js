import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function presignUpload(body) {
  const res = await apiClient.post(endpoints.files.presignUpload, body);
  return unwrapApiData(res);
}

export async function confirmUpload(body) {
  const res = await apiClient.post(endpoints.files.confirmUpload, body);
  return unwrapApiData(res);
}

export async function getFileDownloadUrl(fileId) {
  const res = await apiClient.get(endpoints.files.downloadUrl(fileId));
  return unwrapApiData(res);
}

export async function deleteStoredFile(fileId) {
  const res = await apiClient.delete(endpoints.files.delete(fileId));
  return unwrapApiData(res);
}

export async function fetchAiStatus() {
  const res = await apiClient.get(endpoints.ai.status);
  return unwrapApiData(res);
}

export async function generateAiText(body) {
  const res = await apiClient.post(endpoints.ai.generate, body);
  return unwrapApiData(res);
}
