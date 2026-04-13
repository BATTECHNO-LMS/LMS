import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMicroCredential } from '../microCredentials.service.js';
import { microCredentialsKeys } from './useMicroCredentials.js';

export function useUpdateMicroCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateMicroCredential(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: microCredentialsKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: microCredentialsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: ['learningOutcomes'] });
    },
  });
}
