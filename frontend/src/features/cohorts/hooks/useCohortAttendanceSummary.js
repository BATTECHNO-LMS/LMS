import { useQuery } from '@tanstack/react-query';
import { fetchCohortAttendanceSummary } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

/**
 * @param {string|undefined} cohortId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCohortAttendanceSummary(cohortId, options = {}) {
  return useQuery({
    queryKey: cohortsKeys.attendanceSummary(cohortId),
    queryFn: () => fetchCohortAttendanceSummary(cohortId),
    enabled: Boolean(cohortId),
    ...options,
  });
}
