import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUniversity } from '../universities.service.js';
import { universitiesKeys } from './useUniversities.js';

export function useUpdateUniversity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateUniversity(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: universitiesKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: universitiesKeys.detail(vars.id) });
    },
  });
}
