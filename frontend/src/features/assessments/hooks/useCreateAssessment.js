import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAssessment } from '../assessments.service.js';
import { assessmentsKeys } from './useAssessments.js';

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createAssessment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentsKeys.all });
    },
  });
}
