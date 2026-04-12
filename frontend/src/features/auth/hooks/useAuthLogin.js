import { useMutation } from '@tanstack/react-query';
import { login as loginApi } from '../auth.service.js';
import { useAuth } from './useAuth.js';

export function useAuthLogin() {
  const { applySession } = useAuth();
  return useMutation({
    mutationFn: loginApi,
    onSuccess: (res) => {
      applySession(res.data.token, res.data.user);
    },
  });
}
