import { useQuery } from '@tanstack/react-query';
import { fetchEnrollmentById } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useEnrollment(id, options = {}) {
  return useQuery({
    queryKey: enrollmentsKeys.detail(id),
    queryFn: () => fetchEnrollmentById(id),
    enabled: Boolean(id),
    ...options,
  });
}
