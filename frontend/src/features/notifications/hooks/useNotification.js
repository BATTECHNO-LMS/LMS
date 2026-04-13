import { useQuery } from '@tanstack/react-query';
import { fetchNotificationById } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useNotification(id, options = {}) {
  return useQuery({
    queryKey: notificationsKeys.detail(id),
    queryFn: () => fetchNotificationById(id),
    enabled: Boolean(id),
    ...options,
  });
}
