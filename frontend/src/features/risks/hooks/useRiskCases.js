import { useQuery } from '@tanstack/react-query';
import { fetchRiskCasesList } from '../riskCases.service.js';

export const riskCasesKeys = {
  all: ['risk-cases'],
  list: (params) => [...riskCasesKeys.all, 'list', params],
  detail: (id) => [...riskCasesKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRiskCases(params = {}, options = {}) {
  return useQuery({
    queryKey: riskCasesKeys.list(params),
    queryFn: () => fetchRiskCasesList(params),
    ...options,
  });
}
