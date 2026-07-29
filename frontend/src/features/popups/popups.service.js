import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const admin = endpoints.adminPopups;
const user = endpoints.popups;

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.popups)) return data.popups;
  return [];
}

export async function fetchAdminPopups(params = {}) {
  const res = await apiClient.get(admin, { params });
  const data = unwrapApiData(res);
  return { popups: asList(data) };
}

export async function createAdminPopup(body) {
  const res = await apiClient.post(admin, body);
  return unwrapApiData(res);
}

export async function updateAdminPopup(id, body) {
  const res = await apiClient.patch(`${admin}/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminPopup(id) {
  const res = await apiClient.post(`${admin}/${id}/publish`);
  return unwrapApiData(res);
}

export async function pauseAdminPopup(id) {
  const res = await apiClient.post(`${admin}/${id}/pause`);
  return unwrapApiData(res);
}

export async function archiveAdminPopup(id) {
  const res = await apiClient.post(`${admin}/${id}/archive`);
  return unwrapApiData(res);
}

export async function fetchActivePopups(params = {}) {
  const res = await apiClient.get(`${user}/active`, { params });
  const data = unwrapApiData(res);
  return { popups: asList(data) };
}

export async function viewPopup(id) {
  const res = await apiClient.post(`${user}/${id}/view`);
  return unwrapApiData(res);
}

export async function dismissPopup(id) {
  const res = await apiClient.post(`${user}/${id}/dismiss`);
  return unwrapApiData(res);
}

export async function acknowledgePopup(id) {
  const res = await apiClient.post(`${user}/${id}/acknowledge`);
  return unwrapApiData(res);
}

/**
 * Best-effort load of a published system popup by system_key.
 * Uses admin list when permitted; otherwise active queue. Falls back to null.
 */
export async function fetchSystemPopupByKey(systemKey) {
  if (!systemKey) return null;
  try {
    const adminRes = await apiClient.get(admin, { params: { system_key: systemKey, status: 'PUBLISHED' } });
    const adminData = unwrapApiData(adminRes);
    const fromAdmin = asList(adminData).find((p) => p.system_key === systemKey);
    if (fromAdmin) return fromAdmin;
  } catch {
    /* not admin / unauthenticated — try active */
  }
  try {
    const { popups } = await fetchActivePopups();
    return popups.find((p) => p.system_key === systemKey) || null;
  } catch {
    return null;
  }
}
