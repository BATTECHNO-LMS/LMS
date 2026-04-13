import { useQuery } from '@tanstack/react-query';
import { fetchIntegrityCasesList } from '../integrityCases.service.js';

export const integrityCasesKeys = {
  all: ['integrity-cases'],
  list: (params) => [...integrityCasesKeys.all, 'list', params],
  detail: (id) => [...integrityCasesKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useIntegrityCases(params = {}, options = {}) {
  return useQuery({
    queryKey: integrityCasesKeys.list(params),
    queryFn: () => fetchIntegrityCasesList(params),
    ...options,
  });
}
