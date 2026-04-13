import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCorrectiveAction } from '../correctiveActions.service.js';
import { correctiveActionsKeys } from './useCorrectiveActions.js';

export function useUpdateCorrectiveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateCorrectiveAction(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: correctiveActionsKeys.all }),
  });
}
