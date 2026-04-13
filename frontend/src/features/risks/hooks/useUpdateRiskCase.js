import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRiskCase } from '../riskCases.service.js';
import { riskCasesKeys } from './useRiskCases.js';

export function useUpdateRiskCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateRiskCase(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskCasesKeys.all }),
  });
}
