import { QueryClient } from '@tanstack/react-query';
import { STALE } from './queryDefaults.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.list,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = error?.response?.status ?? error?.status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
