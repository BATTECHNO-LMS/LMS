import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMicroCredential } from '../microCredentials.service.js';
import { microCredentialsKeys } from './useMicroCredentials.js';

export function useCreateMicroCredential() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMicroCredential,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: microCredentialsKeys.all });
      qc.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}
