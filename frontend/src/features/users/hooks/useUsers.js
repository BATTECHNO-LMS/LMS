import { useQuery } from '@tanstack/react-query';
import { fetchUsersList } from '../users.service.js';

export const usersKeys = {
  all: ['users'],
  list: (params) => [...usersKeys.all, 'list', params],
  detail: (id) => [...usersKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params] — forwarded as GET query string
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useUsers(params = {}, options = {}) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => fetchUsersList(params),
    ...options,
  });
}
