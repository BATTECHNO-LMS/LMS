import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCorrectiveAction } from '../correctiveActions.service.js';
import { correctiveActionsKeys } from './useCorrectiveActions.js';

export function useCreateCorrectiveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createCorrectiveAction(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: correctiveActionsKeys.all }),
  });
}
