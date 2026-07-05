import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

function toApiParams(filters = {}) {
  return {
    university_id: filters.universityId || undefined,
    track_id: filters.trackId || undefined,
    micro_credential_id: filters.microCredentialId || undefined,
    cohort_id: filters.cohortId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

export async function fetchAnalyticsOverview(filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/overview`, { params: toApiParams(filters) });
  return unwrapApiData(res);
}

export async function fetchAnalyticsDomain(domain, filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/${domain}`, { params: toApiParams(filters) });
  return unwrapApiData(res);
}

export async function downloadAnalyticsPdf(filters = {}, lang = 'ar') {
  const params = { ...toApiParams(filters), lang: lang === 'en' ? 'en' : 'ar' };
  const res = await apiClient.get(`${endpoints.analytics}/export/pdf`, {
    params,
    responseType: 'blob',
    timeout: 120_000,
  });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `BATTECHNO-LMS-Analytics-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { blob: res.data, filename };
}

export async function downloadAnalyticsExcel(filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/export/excel`, {
    params: toApiParams(filters),
    responseType: 'blob',
    timeout: 180_000,
  });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `BATTECHNO-LMS-Analytics-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { blob: res.data, filename };
}
