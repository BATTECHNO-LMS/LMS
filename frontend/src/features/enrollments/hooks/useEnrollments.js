import { useQuery } from '@tanstack/react-query';
import { fetchEnrollmentsByCohort } from '../enrollments.service.js';

export const enrollmentsKeys = {
  all: ['enrollments'],
  byCohort: (cohortId) => [...enrollmentsKeys.all, 'cohort', cohortId],
  detail: (id) => [...enrollmentsKeys.all, 'detail', id],
};

/**
 * @param {string|undefined} cohortId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useEnrollments(cohortId, options = {}) {
  return useQuery({
    queryKey: enrollmentsKeys.byCohort(cohortId),
    queryFn: () => fetchEnrollmentsByCohort(cohortId),
    enabled: Boolean(cohortId),
    ...options,
  });
}
