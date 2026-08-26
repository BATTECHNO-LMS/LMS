import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchStudentDashboardSummary() {
  const res = await apiClient.get(`${endpoints.student}/dashboard-summary`);
  return unwrapApiData(res);
}
