import { useQuery } from '@tanstack/react-query';
import { fetchGradesList } from '../grades.service.js';

export const gradesKeys = {
  all: ['grades'],
  list: (params) => [...gradesKeys.all, 'list', params],
};

export function useGrades(params = {}, options = {}) {
  return useQuery({
    queryKey: gradesKeys.list(params),
    queryFn: () => fetchGradesList(params),
    ...options,
  });
}
