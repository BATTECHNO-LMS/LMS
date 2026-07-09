import { useQuery } from '@tanstack/react-query';
import { fetchNotificationsList } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';
import { STALE, keepPreviousListData } from '../../../lib/queryDefaults.js';

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useNotifications(params = {}, options = {}) {
  return useQuery({
    queryKey: notificationsKeys.list(params),
    queryFn: () => fetchNotificationsList(params),
    staleTime: STALE.notifications,
    placeholderData: keepPreviousListData,
    ...options,
  });
}
