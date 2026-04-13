import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLearningOutcome } from '../learningOutcomes.service.js';
import { learningOutcomesKeys } from './useLearningOutcomes.js';
import { microCredentialsKeys } from '../../microCredentials/hooks/useMicroCredentials.js';

export function useCreateLearningOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ microCredentialId, body }) => createLearningOutcome(microCredentialId, body),
    onSuccess: (_data, vars) => {
      if (vars?.microCredentialId) {
        qc.invalidateQueries({ queryKey: learningOutcomesKeys.byMicro(vars.microCredentialId) });
        qc.invalidateQueries({ queryKey: microCredentialsKeys.detail(vars.microCredentialId) });
      }
      qc.invalidateQueries({ queryKey: learningOutcomesKeys.all });
    },
  });
}
