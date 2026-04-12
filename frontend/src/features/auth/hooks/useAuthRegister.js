import { useMutation } from '@tanstack/react-query';
import { registerStudent as registerApi } from '../auth.service.js';
import { useAuth } from './useAuth.js';

export function useAuthRegister() {
  const { applySession } = useAuth();
  return useMutation({
    mutationFn: registerApi,
    onSuccess: (res) => {
      applySession(res.data.token, res.data.user);
    },
  });
}
