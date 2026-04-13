import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchCohortStatus } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

export function useUpdateCohortStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchCohortStatus(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: cohortsKeys.all });
      if (vars?.id) {
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(vars.id) });
        qc.invalidateQueries({ queryKey: cohortsKeys.attendanceSummary(vars.id) });
      }
    },
  });
}
