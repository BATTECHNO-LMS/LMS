import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{
 *   user_id?: string,
 *   university_id?: string,
 *   action_type?: string,
 *   entity_type?: string,
 *   from?: string,
 *   to?: string,
 *   search?: string,
 * }} [params]
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
