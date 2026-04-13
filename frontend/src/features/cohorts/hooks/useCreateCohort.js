import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCohort } from '../cohorts.service.js';
import { cohortsKeys } from './useCohorts.js';

export function useCreateCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCohort,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cohortsKeys.all });
    },
  });
}
