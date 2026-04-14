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
