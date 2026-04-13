import { useQuery } from '@tanstack/react-query';
import { fetchSessionById } from '../sessions.service.js';
import { sessionsKeys } from './useSessions.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useSession(id, options = {}) {
  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: () => fetchSessionById(id),
    enabled: Boolean(id),
    ...options,
  });
}
