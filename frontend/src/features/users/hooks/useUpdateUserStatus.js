import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchUserStatus } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => patchUserStatus(id, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: usersKeys.detail(vars.id) });
    },
  });
}
