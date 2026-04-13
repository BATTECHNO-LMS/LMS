import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateQaReview } from '../qaReviews.service.js';
import { qaReviewsKeys } from './useQaReviews.js';

export function useUpdateQaReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateQaReview(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qaReviewsKeys.all });
    },
  });
}
