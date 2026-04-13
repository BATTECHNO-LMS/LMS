import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '../sessions.service.js';
import { sessionsKeys } from './useSessions.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cohortId, body }) => createSession(cohortId, body),
    onSuccess: (_data, vars) => {
      if (vars?.cohortId) {
        qc.invalidateQueries({ queryKey: sessionsKeys.byCohort(vars.cohortId) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(vars.cohortId) });
      }
    },
  });
}
