import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveNotification } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';

export function useArchiveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
