import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchMicroCredentialStatus } from '../microCredentials.service.js';
import { microCredentialsKeys } from './useMicroCredentials.js';

export function useUpdateMicroCredentialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => patchMicroCredentialStatus(id, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: microCredentialsKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: microCredentialsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: ['learningOutcomes'] });
    },
  });
}
