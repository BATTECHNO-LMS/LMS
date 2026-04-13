import { useQuery } from '@tanstack/react-query';
import { fetchSessionsByCohort } from '../sessions.service.js';

export const sessionsKeys = {
  all: ['sessions'],
  byCohort: (cohortId) => [...sessionsKeys.all, 'cohort', cohortId],
  detail: (id) => [...sessionsKeys.all, 'detail', id],
};

/**
 * @param {string|undefined} cohortId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useSessions(cohortId, options = {}) {
  return useQuery({
    queryKey: sessionsKeys.byCohort(cohortId),
    queryFn: () => fetchSessionsByCohort(cohortId),
    enabled: Boolean(cohortId),
    ...options,
  });
}
