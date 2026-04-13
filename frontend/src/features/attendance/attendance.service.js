import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {string} sessionId
 */
export async function fetchSessionAttendance(sessionId) {
  const res = await apiClient.get(`${endpoints.sessions}/${sessionId}/attendance`);
  return unwrapApiData(res);
}

/**
 * @param {string} sessionId
 * @param {{ records: Array<{ student_id: string, attendance_status: string, notes?: string | null }> }} body
 */
export async function saveSessionAttendance(sessionId, body) {
  const res = await apiClient.post(`${endpoints.sessions}/${sessionId}/attendance`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateAttendanceRecord(id, body) {
  const res = await apiClient.put(`${endpoints.attendanceRecords}/${id}`, body);
  return unwrapApiData(res);
}
