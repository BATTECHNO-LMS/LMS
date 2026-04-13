import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{ is_read?: boolean, type?: string }} [params]
 */
export async function fetchNotificationsList(params = {}) {
  const res = await apiClient.get(endpoints.notifications, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.notifications)) {
    throw new Error('Invalid notifications list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchNotificationById(id) {
  const res = await apiClient.get(`${endpoints.notifications}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 */
export async function markNotificationRead(id) {
  const res = await apiClient.patch(`${endpoints.notifications}/${id}/read`);
  return unwrapApiData(res);
}

export async function markAllNotificationsRead() {
  const res = await apiClient.patch(`${endpoints.notifications}/read-all`);
  return unwrapApiData(res);
}
