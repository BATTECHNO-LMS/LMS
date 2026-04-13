import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateAttendanceRecord } from '../attendance.service.js';
import { attendanceKeys } from './useSessionAttendance.js';
import { enrollmentsKeys } from '../../enrollments/hooks/useEnrollments.js';
import { cohortsKeys } from '../../cohorts/hooks/useCohorts.js';

export function useUpdateAttendanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateAttendanceRecord(id, body),
    onSuccess: (data) => {
      const sid = data?.session_id;
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      if (sid) qc.invalidateQueries({ queryKey: attendanceKeys.session(sid) });
      qc.invalidateQueries({ queryKey: enrollmentsKeys.all });
      qc.invalidateQueries({ queryKey: cohortsKeys.all });
    },
  });
}
