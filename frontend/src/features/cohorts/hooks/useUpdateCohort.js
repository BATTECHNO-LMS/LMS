import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCohort } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

export function useUpdateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateCohort(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: cohortsKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: cohortsKeys.detail(vars.id) });
    },
  });
}
