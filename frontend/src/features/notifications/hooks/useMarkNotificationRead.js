import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationRead } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
      if (id) qc.invalidateQueries({ queryKey: notificationsKeys.detail(id) });
    },
  });
}
