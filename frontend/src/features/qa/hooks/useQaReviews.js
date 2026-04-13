import { useQuery } from '@tanstack/react-query';
import { fetchQaReviewsList } from '../qaReviews.service.js';

export const qaReviewsKeys = {
  all: ['qa-reviews'],
  list: (params) => [...qaReviewsKeys.all, 'list', params],
  detail: (id, extra) => [...qaReviewsKeys.all, 'detail', id, extra],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useQaReviews(params = {}, options = {}) {
  return useQuery({
    queryKey: qaReviewsKeys.list(params),
    queryFn: () => fetchQaReviewsList(params),
    ...options,
  });
}
