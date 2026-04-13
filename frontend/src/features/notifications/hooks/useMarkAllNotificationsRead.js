import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsRead } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
