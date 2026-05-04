import { useQuery } from '@tanstack/react-query';
import { fetchPendingEnrollments } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';

/**
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function usePendingEnrollments(options = {}) {
  return useQuery({
    queryKey: enrollmentsKeys.pending(),
    queryFn: fetchPendingEnrollments,
    ...options,
  });
}
