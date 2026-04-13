import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveSessionAttendance } from '../attendance.service.js';
import { attendanceKeys } from './useSessionAttendance.js';
import { enrollmentsKeys } from '../../enrollments/hooks/useEnrollments.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, body }) => saveSessionAttendance(sessionId, body),
    onSuccess: (data) => {
      const sid = data?.session_id;
      const cid = data?.cohort_id;
      if (sid) qc.invalidateQueries({ queryKey: attendanceKeys.session(sid) });
      if (cid) {
        qc.invalidateQueries({ queryKey: enrollmentsKeys.byCohort(cid) });
        qc.invalidateQueries({ queryKey: cohortsKeys.attendanceSummary(cid) });
        qc.invalidateQueries({ queryKey: cohortsKeys.detail(cid) });
      }
    },
  });
}
