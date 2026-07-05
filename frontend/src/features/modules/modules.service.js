import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchModules(params = {}) {
  const res = await apiClient.get(endpoints.modules, { params });
  return unwrapApiData(res);
}
