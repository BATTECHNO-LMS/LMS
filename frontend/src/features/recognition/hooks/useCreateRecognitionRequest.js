import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecognitionRequest } from '../recognitionRequests.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useCreateRecognitionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createRecognitionRequest(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recognitionKeys.all });
    },
  });
}
