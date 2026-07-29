import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acknowledgeNotification } from '../notifications.service.js';
import { notificationsKeys } from './notificationsQueryKeys.js';

export function useAcknowledgeNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  });
}
