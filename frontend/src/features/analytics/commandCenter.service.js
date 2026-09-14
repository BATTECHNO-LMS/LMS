import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { getStorageItem, storageKeys } from '../../utils/storage.js';

export function toCommandCenterParams(filters = {}) {
  const params = {
    period: filters.period || '30d',
    organizationId: filters.organizationId || undefined,
    organizationType: filters.organizationType || undefined,
    universityId: filters.universityId || undefined,
    opportunityId: filters.opportunityId || undefined,
    role: filters.role || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    orgMetric: filters.orgMetric || undefined,
    activityCategory: filters.activityCategory || undefined,
  };
  Object.keys(params).forEach((k) => {
    if (params[k] == null || params[k] === '') delete params[k];
  });
  return params;
}

export async function fetchCommandCenterOverview(filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/command-center`, {
    params: toCommandCenterParams(filters),
    timeout: 60_000,
  });
  return unwrapApiData(res);
}

export async function fetchCommandCenterFilters(filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/command-center/filters`, {
    params: toCommandCenterParams(filters),
  });
  return unwrapApiData(res);
}

export async function fetchCommandCenterLive(filters = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/command-center/live-snapshot`, {
    params: toCommandCenterParams(filters),
  });
  return unwrapApiData(res);
}

export async function fetchCommandCenterDrilldown(filters = {}, extra = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/command-center/drilldown`, {
    params: { ...toCommandCenterParams(filters), ...extra },
  });
  return unwrapApiData(res);
}

export function commandCenterLiveUrl(filters = {}) {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const params = new URLSearchParams(toCommandCenterParams(filters));
  const token = getStorageItem(storageKeys.authToken);
  if (token) params.set('access_token', token);
  return `${base}${endpoints.analytics}/command-center/live?${params.toString()}`;
}
