import { useQuery } from '@tanstack/react-query';
import { fetchMyGrades } from '../grades.service.js';

export function useStudentGrades(options = {}) {
  return useQuery({
    queryKey: ['grades', 'me'],
    queryFn: fetchMyGrades,
    ...options,
  });
}
