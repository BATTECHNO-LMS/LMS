import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createIntegrityCase } from '../integrityCases.service.js';
import { integrityCasesKeys } from './useIntegrityCases.js';

export function useCreateIntegrityCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createIntegrityCase(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrityCasesKeys.all }),
  });
}
