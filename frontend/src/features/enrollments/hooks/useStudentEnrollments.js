import { useQuery } from '@tanstack/react-query';
import { fetchMyEnrollments } from '../enrollments.service.js';

export function useStudentEnrollments(options = {}) {
  return useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: fetchMyEnrollments,
    ...options,
  });
}
