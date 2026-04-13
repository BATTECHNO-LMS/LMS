import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSession } from '../sessions.service.js';
import { sessionsKeys } from './useSessions.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateSession(id, body),
    onSuccess: (data) => {
      const cid = data?.cohort_id;
      qc.invalidateQueries({ queryKey: sessionsKeys.all });
      if (cid) {
        qc.invalidateQueries({ queryKey: sessionsKeys.byCohort(cid) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(cid) });
      }
    },
  });
}
