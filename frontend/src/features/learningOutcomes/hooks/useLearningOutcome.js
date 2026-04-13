import { useQuery } from '@tanstack/react-query';
import { fetchLearningOutcomeById } from '../learningOutcomes.service.js';
import { learningOutcomesKeys } from './useLearningOutcomes.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useLearningOutcome(id, options = {}) {
  return useQuery({
    queryKey: learningOutcomesKeys.detail(id),
    queryFn: () => fetchLearningOutcomeById(id),
    enabled: Boolean(id),
    ...options,
  });
}
