import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRecognitionRequest } from '../recognitionRequests.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useUpdateRecognitionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateRecognitionRequest(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: recognitionKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: recognitionKeys.detail(vars.id) });
    },
  });
}
