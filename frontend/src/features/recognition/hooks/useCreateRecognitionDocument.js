import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecognitionDocument } from '../recognitionDocuments.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useCreateRecognitionDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recognitionRequestId, body }) => createRecognitionDocument(recognitionRequestId, body),
    onSuccess: (_data, vars) => {
      const rid = vars?.recognitionRequestId;
      if (rid) {
        qc.invalidateQueries({ queryKey: recognitionKeys.documents(rid) });
        qc.invalidateQueries({ queryKey: recognitionKeys.detail(rid) });
      }
    },
  });
}
