import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchRiskCaseStatus } from '../riskCases.service.js';
import { riskCasesKeys } from './useRiskCases.js';

export function useUpdateRiskCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchRiskCaseStatus(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskCasesKeys.all }),
  });
}
