import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * Server-side paginated activity log (scoped by the backend to the requester's tenant).
 * @param {Record<string, string | number | undefined>} [params]
 */
export async function fetchAuditLogsList(params = {}) {
  const res = await apiClient.get(endpoints.auditLogs, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.audit_logs)) {
    throw new Error('Invalid audit logs list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchAuditLogById(id) {
  const res = await apiClient.get(`${endpoints.auditLogs}/${id}`);
  return unwrapApiData(res);
}

/** Categories, outcomes and registered actions with Arabic/English labels. */
export async function fetchAuditCatalog() {
  const res = await apiClient.get(`${endpoints.auditLogs}/catalog`);
  return unwrapApiData(res);
}

/**
 * Human-readable activity history of one user (actions by them and actions affecting them).
 * @param {string} userId
 * @param {{ page?: number, page_size?: number, from?: string, to?: string, include_security?: 'true'|'false' }} [params]
 */
export async function fetchUserActivityTimeline(userId, params = {}) {
  const res = await apiClient.get(`${endpoints.auditLogs}/students/${userId}/timeline`, { params });
  return unwrapApiData(res);
}

/** @param {string} userId */
export async function fetchUserSessions(userId) {
  const res = await apiClient.get(`${endpoints.auditLogs}/users/${userId}/sessions`);
  return unwrapApiData(res);
}

/** Ends exactly one session (ADMIN_REVOKED). */
export async function revokeUserSession(sessionId) {
  const res = await apiClient.post(`${endpoints.auditLogs}/sessions/${sessionId}/revoke`);
  return unwrapApiData(res);
}
