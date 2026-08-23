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
