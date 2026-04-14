import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login as loginApi } from '../auth.service.js';
import { useAuth } from './useAuth.js';

export function useAuthLogin() {
  const qc = useQueryClient();
  const { persistTokenAndHydrate } = useAuth();
  return useMutation({
    mutationFn: loginApi,
    onSuccess: async (res) => {
      await persistTokenAndHydrate(res.data.token);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['universities'] });
    },
  });
}
