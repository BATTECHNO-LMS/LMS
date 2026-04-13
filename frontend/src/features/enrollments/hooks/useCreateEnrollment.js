import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEnrollment } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cohortId, body }) => createEnrollment(cohortId, body),
    onSuccess: (_data, vars) => {
      if (vars?.cohortId) {
        qc.invalidateQueries({ queryKey: enrollmentsKeys.byCohort(vars.cohortId) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(vars.cohortId) });
        qc.invalidateQueries({ queryKey: cohortsKeys.attendanceSummary(vars.cohortId) });
      }
      qc.invalidateQueries({ queryKey: cohortsKeys.all });
    },
  });
}
