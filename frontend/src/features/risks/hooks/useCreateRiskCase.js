import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRiskCase } from '../riskCases.service.js';
import { riskCasesKeys } from './useRiskCases.js';

export function useCreateRiskCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createRiskCase(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: riskCasesKeys.all }),
  });
}
