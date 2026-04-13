import { useQuery } from '@tanstack/react-query';
import { fetchEvidenceList } from '../evidence.service.js';

export const evidenceKeys = {
  all: ['evidence'],
  list: (params) => [...evidenceKeys.all, 'list', params],
  detail: (id) => [...evidenceKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useEvidence(params = {}, options = {}) {
  return useQuery({
    queryKey: evidenceKeys.list(params),
    queryFn: () => fetchEvidenceList(params),
    ...options,
  });
}
