import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateAllPendingUsers } from '../users.service.js';
import { usersKeys } from './useUsers.js';

async function withNetworkRetry(fn, retries = 1) {
  try {
    return await fn();
  } catch (err) {
    const code = err?.code || err?.cause?.code;
    const isNetwork =
      !err?.response &&
      (code === 'ERR_NETWORK' || code === 'ECONNREFUSED' || String(err?.message || '').includes('Network Error'));
    if (isNetwork && retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return withNetworkRetry(fn, retries - 1);
    }
    throw err;
  }
}

export function useActivateAllPendingUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params = {}) => withNetworkRetry(() => activateAllPendingUsers(params)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
