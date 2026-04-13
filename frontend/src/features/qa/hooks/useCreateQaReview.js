import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQaReview } from '../qaReviews.service.js';
import { qaReviewsKeys } from './useQaReviews.js';

export function useCreateQaReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createQaReview(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qaReviewsKeys.all }),
  });
}
