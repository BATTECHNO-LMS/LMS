import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const rules = endpoints.adminNotificationRules;
const templates = endpoints.adminNotificationTemplates;
const ops = endpoints.adminNotificationsOps;

export async function fetchNotificationCatalog() {
  const res = await apiClient.get(`${rules}/catalog`);
  return unwrapApiData(res);
}

export async function fetchAdminNotificationRules(params = {}) {
  const res = await apiClient.get(rules, { params });
  return unwrapApiData(res);
}

export async function fetchAdminNotificationRule(id) {
  const res = await apiClient.get(`${rules}/${id}`);
  return unwrapApiData(res);
}

export async function createAdminNotificationRule(body) {
  const res = await apiClient.post(rules, body);
  return unwrapApiData(res);
}

export async function updateAdminNotificationRule(id, body) {
  const res = await apiClient.patch(`${rules}/${id}`, body);
  return unwrapApiData(res);
}

export async function activateAdminNotificationRule(id) {
  const res = await apiClient.post(`${rules}/${id}/activate`);
  return unwrapApiData(res);
}

export async function pauseAdminNotificationRule(id) {
  const res = await apiClient.post(`${rules}/${id}/pause`);
  return unwrapApiData(res);
}

export async function archiveAdminNotificationRule(id) {
  const res = await apiClient.post(`${rules}/${id}/archive`);
  return unwrapApiData(res);
}

export async function fetchAdminNotificationTemplates(params = {}) {
  const res = await apiClient.get(templates, { params });
  return unwrapApiData(res);
}

export async function createAdminNotificationTemplate(body) {
  const res = await apiClient.post(templates, body);
  return unwrapApiData(res);
}

export async function updateAdminNotificationTemplate(id, body) {
  const res = await apiClient.patch(`${templates}/${id}`, body);
  return unwrapApiData(res);
}

export async function previewAdminNotificationTemplate(body) {
  const res = await apiClient.post(`${templates}/preview`, body);
  return unwrapApiData(res);
}

export async function fetchAdminNotificationDeliveries(params = {}) {
  const res = await apiClient.get(`${ops}/deliveries`, { params });
  return unwrapApiData(res);
}

export async function fetchAdminNotificationFailures(params = {}) {
  const res = await apiClient.get(`${ops}/failures`, { params });
  return unwrapApiData(res);
}

export async function retryAdminNotificationDelivery(id) {
  const res = await apiClient.post(`${ops}/deliveries/${id}/retry`);
  return unwrapApiData(res);
}

export async function fetchAdminNotificationAnalytics(params = {}) {
  const res = await apiClient.get(`${ops}/analytics`, { params });
  return unwrapApiData(res);
}

export async function sendAdminNotification(body) {
  const res = await apiClient.post(`${ops}/send`, body);
  return unwrapApiData(res);
}

export async function previewAdminNotificationSend(body) {
  const res = await apiClient.post(`${ops}/send/preview`, body);
  return unwrapApiData(res);
}
