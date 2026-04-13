import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEvidence } from '../evidence.service.js';
import { evidenceKeys } from './useEvidence.js';

export function useCreateEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createEvidence(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evidenceKeys.all });
    },
  });
}
