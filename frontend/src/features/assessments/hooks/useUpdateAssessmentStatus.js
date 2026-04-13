import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchAssessmentStatus } from '../assessments.service.js';
import { assessmentsKeys } from './useAssessments.js';

export function useUpdateAssessmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchAssessmentStatus(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: assessmentsKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: assessmentsKeys.detail(vars.id) });
    },
  });
}
