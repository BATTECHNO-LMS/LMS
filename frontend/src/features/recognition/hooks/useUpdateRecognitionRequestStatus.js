import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchRecognitionRequestStatus } from '../recognitionRequests.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useUpdateRecognitionRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchRecognitionRequestStatus(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: recognitionKeys.all });
      if (vars?.id) {
        qc.invalidateQueries({ queryKey: recognitionKeys.detail(vars.id) });
        qc.invalidateQueries({ queryKey: recognitionKeys.documents(vars.id) });
      }
    },
  });
}
