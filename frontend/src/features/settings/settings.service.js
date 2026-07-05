import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchSettings() {
  const res = await apiClient.get(endpoints.settings);
  return unwrapApiData(res);
}

export async function updateSettings(payload) {
  const res = await apiClient.put(endpoints.settings, payload);
  return unwrapApiData(res);
}
