import { useQuery } from '@tanstack/react-query';
import { fetchUnreadNotificationCount } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';
import { STALE } from '../../../lib/queryDefaults.js';

/**
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useUnreadNotificationCount(options = {}) {
  return useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: fetchUnreadNotificationCount,
    staleTime: STALE.notifications,
    ...options,
  });
}
