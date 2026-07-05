import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchRolesOverview() {
  const res = await apiClient.get(endpoints.roles);
  return unwrapApiData(res);
}

export async function fetchRoleById(id) {
  const res = await apiClient.get(`${endpoints.roles}/${id}`);
  return unwrapApiData(res);
}
