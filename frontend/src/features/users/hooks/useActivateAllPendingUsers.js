import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateAllPendingUsers } from '../users.service.js';

export function useActivateAllPendingUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params = {}) => activateAllPendingUsers(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
