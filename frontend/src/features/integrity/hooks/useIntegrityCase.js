import { useQuery } from '@tanstack/react-query';
import { fetchIntegrityCaseById } from '../integrityCases.service.js';
import { integrityCasesKeys } from './useIntegrityCases.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useIntegrityCase(id, options = {}) {
  return useQuery({
    queryKey: integrityCasesKeys.detail(id),
    queryFn: () => fetchIntegrityCaseById(id),
    enabled: Boolean(id),
    ...options,
  });
}
