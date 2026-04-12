import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUser } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: usersKeys.detail(vars.id) });
    },
  });
}
