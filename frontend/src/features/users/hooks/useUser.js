import { useQuery } from '@tanstack/react-query';
import { fetchUserById } from '../users.service.js';
import { usersKeys } from './useUsers.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useUser(id, options = {}) {
  return useQuery({
    queryKey: usersKeys.detail(id),
    queryFn: () => fetchUserById(id),
    enabled: Boolean(id),
    ...options,
  });
}
