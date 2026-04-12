import { useQuery } from '@tanstack/react-query';
import { fetchUniversitiesList } from '../universities.service.js';

export const universitiesKeys = {
  all: ['universities'],
  list: () => [...universitiesKeys.all, 'list'],
  detail: (id) => [...universitiesKeys.all, 'detail', id],
};

/**
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useUniversities(options = {}) {
  return useQuery({
    queryKey: universitiesKeys.list(),
    queryFn: fetchUniversitiesList,
    ...options,
  });
}
