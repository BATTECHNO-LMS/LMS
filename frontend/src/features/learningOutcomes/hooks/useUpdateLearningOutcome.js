import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLearningOutcome } from '../learningOutcomes.service.js';
import { learningOutcomesKeys } from './useLearningOutcomes.js';

export function useUpdateLearningOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, microCredentialId }) => updateLearningOutcome(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: learningOutcomesKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: learningOutcomesKeys.detail(vars.id) });
      if (vars?.microCredentialId) {
        qc.invalidateQueries({ queryKey: learningOutcomesKeys.byMicro(vars.microCredentialId) });
      }
    },
  });
}
