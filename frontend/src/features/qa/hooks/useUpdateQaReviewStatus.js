import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchQaReviewStatus } from '../qaReviews.service.js';
import { qaReviewsKeys } from './useQaReviews.js';

export function useUpdateQaReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchQaReviewStatus(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qaReviewsKeys.all });
    },
  });
}
