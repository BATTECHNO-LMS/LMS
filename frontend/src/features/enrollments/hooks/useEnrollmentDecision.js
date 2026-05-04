import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveEnrollmentRequest, rejectEnrollmentRequest } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';

export function useApproveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => approveEnrollmentRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: enrollmentsKeys.pending() });
      qc.invalidateQueries({ queryKey: enrollmentsKeys.mine() });
    },
  });
}

export function useRejectEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => rejectEnrollmentRequest(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: enrollmentsKeys.pending() });
      qc.invalidateQueries({ queryKey: enrollmentsKeys.mine() });
    },
  });
}
