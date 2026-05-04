import { useQuery } from '@tanstack/react-query';
import { fetchAvailableCohorts } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

/**
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useAvailableCohorts(options = {}) {
  return useQuery({
    queryKey: cohortsKeys.available(),
    queryFn: fetchAvailableCohorts,
    ...options,
  });
}
