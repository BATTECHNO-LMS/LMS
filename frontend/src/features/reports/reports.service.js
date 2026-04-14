import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

function normalizeParams(params = {}) {
  return {
    university_id: params.university_id || undefined,
    track_id: params.track_id || undefined,
    micro_credential_id: params.micro_credential_id || undefined,
    cohort_id: params.cohort_id || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
}

export async function fetchReport(type, params = {}) {
  const res = await apiClient.get(`${endpoints.reports}/${type}`, {
    params: normalizeParams(params),
  });
  return unwrapApiData(res);
}

export async function exportReport(type, format = 'json', params = {}) {
  if (format === 'csv') {
    const res = await apiClient.get(`${endpoints.reports}/${type}/export`, {
      params: { ...normalizeParams(params), format: 'csv' },
      responseType: 'text',
    });
    return {
      format: 'csv',
      content: res.data,
      filename: `${type}-report.csv`,
    };
  }
  const res = await apiClient.get(`${endpoints.reports}/${type}/export`, {
    params: { ...normalizeParams(params), format: 'json' },
  });
  return {
    format: 'json',
    content: unwrapApiData(res),
  };
}
