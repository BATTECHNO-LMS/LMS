import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateIntegrityCase } from '../integrityCases.service.js';
import { integrityCasesKeys } from './useIntegrityCases.js';

export function useUpdateIntegrityCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateIntegrityCase(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrityCasesKeys.all }),
  });
}
