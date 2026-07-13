import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminResetUserPassword } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useAdminResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => adminResetUserPassword(id, body),
    onSuccess: (_data, vars) => {
      if (vars?.id) qc.invalidateQueries({ queryKey: usersKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
