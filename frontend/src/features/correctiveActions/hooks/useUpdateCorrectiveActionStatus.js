import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchCorrectiveActionStatus } from '../correctiveActions.service.js';
import { correctiveActionsKeys } from './useCorrectiveActions.js';

export function useUpdateCorrectiveActionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchCorrectiveActionStatus(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: correctiveActionsKeys.all }),
  });
}
