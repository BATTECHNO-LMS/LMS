import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerStudent as registerApi } from '../auth.service.js';
import { useAuth } from './useAuth.js';

export function useAuthRegister() {
  const qc = useQueryClient();
  const { persistTokenAndHydrate } = useAuth();
  return useMutation({
    mutationFn: registerApi,
    onSuccess: async (res) => {
      await persistTokenAndHydrate(res.data.token);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['universities'] });
    },
  });
}
