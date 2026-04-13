import { useQuery } from '@tanstack/react-query';
import { fetchEvidenceById } from '../evidence.service.js';
import { evidenceKeys } from './useEvidence.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useEvidenceItem(id, options = {}) {
  return useQuery({
    queryKey: evidenceKeys.detail(id),
    queryFn: () => fetchEvidenceById(id),
    enabled: Boolean(id),
    ...options,
  });
}
