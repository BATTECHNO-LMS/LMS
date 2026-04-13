import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchSessionDocumentationStatus } from '../sessions.service.js';
import { sessionsKeys } from './useSessions.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useUpdateSessionDocumentationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchSessionDocumentationStatus(id, body),
    onSuccess: (data) => {
      const cid = data?.cohort_id;
      const sid = data?.id;
      qc.invalidateQueries({ queryKey: sessionsKeys.all });
      if (cid) {
        qc.invalidateQueries({ queryKey: sessionsKeys.byCohort(cid) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(cid) });
      }
      if (sid) qc.invalidateQueries({ queryKey: sessionsKeys.detail(sid) });
    },
  });
}
