import { useQuery } from '@tanstack/react-query';
import { fetchRubricById } from '../rubrics.service.js';
import { rubricsKeys } from './useRubrics.js';

export function useRubric(id, options = {}) {
  return useQuery({
    queryKey: rubricsKeys.detail(id),
    queryFn: () => fetchRubricById(id),
    enabled: Boolean(id),
    ...options,
  });
}
