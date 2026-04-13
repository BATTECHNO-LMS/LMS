import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRecognitionDocument } from '../recognitionDocuments.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

export function useUpdateRecognitionDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, recognitionRequestId }) => updateRecognitionDocument(id, body),
    onSuccess: (_data, vars) => {
      if (vars?.recognitionRequestId) {
        qc.invalidateQueries({ queryKey: recognitionKeys.documents(vars.recognitionRequestId) });
        qc.invalidateQueries({ queryKey: recognitionKeys.detail(vars.recognitionRequestId) });
      }
      if (vars?.id) qc.invalidateQueries({ queryKey: recognitionKeys.document(vars.id) });
    },
  });
}
