import { useMutation, useQueryClient } from '@tanstack/react-query';
import { verifyUserEmail } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useVerifyUserEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => verifyUserEmail(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
      if (id) qc.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}
