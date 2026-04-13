import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteLearningOutcome } from '../learningOutcomes.service.js';
import { learningOutcomesKeys } from './useLearningOutcomes.js';
import { microCredentialsKeys } from '../../microCredentials/hooks/useMicroCredentials.js';

export function useDeleteLearningOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, microCredentialId }) => deleteLearningOutcome(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: learningOutcomesKeys.all });
      if (vars?.microCredentialId) {
        qc.invalidateQueries({ queryKey: learningOutcomesKeys.byMicro(vars.microCredentialId) });
        qc.invalidateQueries({ queryKey: microCredentialsKeys.detail(vars.microCredentialId) });
      }
    },
  });
}
