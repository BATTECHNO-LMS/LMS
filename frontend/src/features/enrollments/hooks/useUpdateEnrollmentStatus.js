import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchEnrollmentStatus } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useUpdateEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchEnrollmentStatus(id, body),
    onSuccess: (data) => {
      const cid = data?.cohort_id;
      qc.invalidateQueries({ queryKey: enrollmentsKeys.all });
      if (cid) {
        qc.invalidateQueries({ queryKey: enrollmentsKeys.byCohort(cid) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(cid) });
      }
    },
  });
}
