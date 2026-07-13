import { useQuery } from '@tanstack/react-query';
import { fetchMyGrades } from '../grades.service.js';

/**
 * Student grades for the authenticated user.
 * @param {Record<string, unknown>} [params] — filter fields only (no page/page_size; backend has no pagination)
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useStudentGrades(params = {}, options = {}) {
  return useQuery({
    queryKey: ['grades', 'me', params],
    queryFn: () => fetchMyGrades(params),
    ...options,
  });
}
