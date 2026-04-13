import { useQuery } from '@tanstack/react-query';
import { fetchAssessmentById } from '../assessments.service.js';
import { assessmentsKeys } from './useAssessments.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useAssessment(id, options = {}) {
  return useQuery({
    queryKey: assessmentsKeys.detail(id),
    queryFn: () => fetchAssessmentById(id),
    enabled: Boolean(id),
    ...options,
  });
}
