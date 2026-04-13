import { useQuery } from '@tanstack/react-query';
import { fetchAssessmentsList } from '../assessments.service.js';

export const assessmentsKeys = {
  all: ['assessments'],
  list: (params) => [...assessmentsKeys.all, 'list', params],
  detail: (id) => [...assessmentsKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useAssessments(params = {}, options = {}) {
  return useQuery({
    queryKey: assessmentsKeys.list(params),
    queryFn: () => fetchAssessmentsList(params),
    ...options,
  });
}
