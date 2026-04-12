import { useQuery } from '@tanstack/react-query';
import { fetchUniversityById } from '../universities.service.js';
import { universitiesKeys } from './useUniversities.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useUniversity(id, options = {}) {
  return useQuery({
    queryKey: universitiesKeys.detail(id),
    queryFn: () => fetchUniversityById(id),
    enabled: Boolean(id),
    ...options,
  });
}
