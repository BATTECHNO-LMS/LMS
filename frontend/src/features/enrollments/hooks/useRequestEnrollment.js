import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postEnrollmentRequest } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useRequestEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => postEnrollmentRequest(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: enrollmentsKeys.mine() });
      qc.invalidateQueries({ queryKey: cohortsKeys.available() });
    },
  });
}
