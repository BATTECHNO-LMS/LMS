import { useQuery } from '@tanstack/react-query';
import { fetchRiskCaseById } from '../riskCases.service.js';
import { riskCasesKeys } from './useRiskCases.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRiskCase(id, options = {}) {
  return useQuery({
    queryKey: riskCasesKeys.detail(id),
    queryFn: () => fetchRiskCaseById(id),
    enabled: Boolean(id),
    ...options,
  });
}
