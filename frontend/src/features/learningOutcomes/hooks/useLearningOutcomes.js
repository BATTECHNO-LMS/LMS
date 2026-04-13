import { useQuery } from '@tanstack/react-query';
import { fetchLearningOutcomesByMicroCredential } from '../learningOutcomes.service.js';

export const learningOutcomesKeys = {
  all: ['learningOutcomes'],
  byMicro: (microCredentialId) => [...learningOutcomesKeys.all, 'micro', microCredentialId],
  detail: (id) => [...learningOutcomesKeys.all, 'detail', id],
};

/**
 * @param {string | undefined} microCredentialId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useLearningOutcomes(microCredentialId, options = {}) {
  return useQuery({
    queryKey: learningOutcomesKeys.byMicro(microCredentialId),
    queryFn: () => fetchLearningOutcomesByMicroCredential(microCredentialId),
    enabled: Boolean(microCredentialId),
    ...options,
  });
}
