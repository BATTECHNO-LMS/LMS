import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{
 *   student_id?: string,
 *   cohort_id?: string,
 *   micro_credential_id?: string,
 *   status?: string,
 *   search?: string,
 * }} [params]
 */
export async function fetchCertificatesList(params = {}) {
  const res = await apiClient.get(endpoints.certificates, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.certificates)) {
    throw new Error('Invalid certificates list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchCertificateById(id) {
  const res = await apiClient.get(`${endpoints.certificates}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createCertificate(body) {
  const res = await apiClient.post(endpoints.certificates, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchCertificateStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.certificates}/${id}/status`, body);
  return unwrapApiData(res);
}

/**
 * Public verification (no auth required; token may still be sent by axios).
 * @param {string} verificationCode
 */
export async function verifyCertificateByCode(verificationCode) {
  const res = await apiClient.get(`${endpoints.certificates}/verify/${encodeURIComponent(verificationCode)}`);
  return unwrapApiData(res);
}
