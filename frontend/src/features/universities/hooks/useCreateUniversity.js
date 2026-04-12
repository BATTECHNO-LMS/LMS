import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUniversity } from '../universities.service.js';
import { universitiesKeys } from './useUniversities.js';

export function useCreateUniversity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUniversity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: universitiesKeys.all });
    },
  });
}
