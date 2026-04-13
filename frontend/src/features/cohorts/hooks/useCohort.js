import { useQuery } from '@tanstack/react-query';
import { fetchCohortById } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCohort(id, options = {}) {
  return useQuery({
    queryKey: cohortsKeys.detail(id),
    queryFn: () => fetchCohortById(id),
    enabled: Boolean(id),
    ...options,
  });
}
