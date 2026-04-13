import { useQuery } from '@tanstack/react-query';
import { fetchRubricsList } from '../rubrics.service.js';

export const rubricsKeys = {
  all: ['rubrics'],
  list: (params) => [...rubricsKeys.all, 'list', params],
  detail: (id) => [...rubricsKeys.all, 'detail', id],
};

export function useRubrics(params = {}, options = {}) {
  return useQuery({
    queryKey: rubricsKeys.list(params),
    queryFn: () => fetchRubricsList(params),
    ...options,
  });
}
