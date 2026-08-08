import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{ is_read?: boolean, type?: string, page?: number, page_size?: number }} [params]
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

export async function fetchUnreadNotificationCount() {
  const res = await apiClient.get(`${endpoints.notifications}/unread-count`);
  return unwrapApiData(res);
}

export async function acknowledgeNotification(id) {
  const res = await apiClient.post(`${endpoints.notifications}/${id}/acknowledge`);
  return unwrapApiData(res);
}

export async function archiveNotification(id) {
  const res = await apiClient.post(`${endpoints.notifications}/${id}/archive`);
  return unwrapApiData(res);
}

export async function fetchNotificationPreferences() {
  const res = await apiClient.get(`${endpoints.notifications}/preferences`);
  return unwrapApiData(res);
}

/**
 * @param {{ preferences: Array<{ notification_category: string, channel: string, is_enabled: boolean }> }} body
 */
export async function updateNotificationPreferences(body) {
  const res = await apiClient.patch(`${endpoints.notifications}/preferences`, body);
  return unwrapApiData(res);
}
