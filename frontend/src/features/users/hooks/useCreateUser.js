import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser } from '../users.service.js';
import { usersKeys } from './useUsers.js';

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
