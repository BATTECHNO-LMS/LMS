import { useQuery } from '@tanstack/react-query';
import { fetchMyEnrollments } from '../enrollments.service.js';
import { enrollmentsKeys } from './useEnrollments.js';

export function useStudentEnrollments(options = {}) {
  return useQuery({
    queryKey: enrollmentsKeys.mine(),
    queryFn: fetchMyEnrollments,
    ...options,
  });
}
