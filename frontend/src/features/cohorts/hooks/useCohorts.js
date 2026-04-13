import { useQuery } from '@tanstack/react-query';
import { fetchCohortsList } from '../cohorts.service.js';

export const cohortsKeys = {
  all: ['cohorts'],
  list: (params) => [...cohortsKeys.all, 'list', params],
  detail: (id) => [...cohortsKeys.all, 'detail', id],
  attendanceSummary: (id) => [...cohortsKeys.all, 'attendance-summary', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCohorts(params = {}, options = {}) {
  return useQuery({
    queryKey: cohortsKeys.list(params),
    queryFn: () => fetchCohortsList(params),
    ...options,
  });
}
