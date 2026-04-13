import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEvidence } from '../evidence.service.js';
import { evidenceKeys } from './useEvidence.js';

export function useUpdateEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateEvidence(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: evidenceKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: evidenceKeys.detail(vars.id) });
    },
  });
}
