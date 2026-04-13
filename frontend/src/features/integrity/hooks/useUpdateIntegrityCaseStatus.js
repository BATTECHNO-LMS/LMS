import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchIntegrityCaseStatus } from '../integrityCases.service.js';
import { integrityCasesKeys } from './useIntegrityCases.js';

export function useUpdateIntegrityCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchIntegrityCaseStatus(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: integrityCasesKeys.all }),
  });
}
