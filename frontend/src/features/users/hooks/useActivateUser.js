import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateUserAccount } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => activateUserAccount(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
      if (id) qc.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}
