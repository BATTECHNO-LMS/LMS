import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const admin = endpoints.adminAnnouncements;
const user = endpoints.announcements;

export async function fetchAdminAnnouncements(params = {}) {
  const res = await apiClient.get(admin, { params });
  return unwrapApiData(res);
}

export async function createAdminAnnouncement(body) {
  const res = await apiClient.post(admin, body);
  return unwrapApiData(res);
}

export async function updateAdminAnnouncement(id, body) {
  const res = await apiClient.patch(`${admin}/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${admin}/${id}/publish`, body);
  return unwrapApiData(res);
}

export async function scheduleAdminAnnouncement(id, body) {
  const res = await apiClient.post(`${admin}/${id}/schedule`, body);
  return unwrapApiData(res);
}

export async function pauseAdminAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${admin}/${id}/pause`, body);
  return unwrapApiData(res);
}

export async function archiveAdminAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${admin}/${id}/archive`, body);
  return unwrapApiData(res);
}

export async function duplicateAdminAnnouncement(id) {
  const res = await apiClient.post(`${admin}/${id}/duplicate`);
  return unwrapApiData(res);
}

export async function fetchAdminAnnouncementAnalytics(id) {
  const res = await apiClient.get(`${admin}/${id}/analytics`);
  return unwrapApiData(res);
}

export async function fetchActiveAnnouncements() {
  const res = await apiClient.get(`${user}/active`);
  const data = unwrapApiData(res);
  if (Array.isArray(data)) return { items: data };
  if (data && Array.isArray(data.items)) return data;
  if (data && Array.isArray(data.announcements)) return { items: data.announcements };
  return { items: [] };
}

export async function viewAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${user}/${id}/view`, body);
  return unwrapApiData(res);
}

export async function dismissAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${user}/${id}/dismiss`, body);
  return unwrapApiData(res);
}

export async function acknowledgeAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${user}/${id}/acknowledge`, body);
  return unwrapApiData(res);
}

export async function clickAnnouncement(id, body = {}) {
  const res = await apiClient.post(`${user}/${id}/click`, body);
  return unwrapApiData(res);
}
