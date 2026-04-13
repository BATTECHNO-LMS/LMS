import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {Record<string, unknown>} [params]
 */
export async function fetchRiskCasesList(params = {}) {
  const res = await apiClient.get(endpoints.riskCases, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.risk_cases)) {
    throw new Error('Invalid risk cases list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchRiskCaseById(id) {
  const res = await apiClient.get(`${endpoints.riskCases}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createRiskCase(body) {
  const res = await apiClient.post(endpoints.riskCases, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateRiskCase(id, body) {
  const res = await apiClient.put(`${endpoints.riskCases}/${id}`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ status: string }} body
 */
export async function patchRiskCaseStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.riskCases}/${id}/status`, body);
  return unwrapApiData(res);
}
