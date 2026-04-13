import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRecognitionDocument } from '../recognitionDocuments.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useDeleteRecognitionDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recognitionRequestId }) => deleteRecognitionDocument(id),
    onSuccess: (_data, vars) => {
      const rid = vars?.recognitionRequestId;
      if (rid) {
        qc.invalidateQueries({ queryKey: recognitionKeys.documents(rid) });
        qc.invalidateQueries({ queryKey: recognitionKeys.detail(rid) });
      }
    },
  });
}
