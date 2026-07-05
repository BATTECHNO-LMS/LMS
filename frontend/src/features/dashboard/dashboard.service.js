import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchAdminDashboardStats() {
  const res = await apiClient.get(`${endpoints.dashboard}/admin-stats`);
  return unwrapApiData(res);
}
