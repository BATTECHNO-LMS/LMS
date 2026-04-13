import { useQuery } from '@tanstack/react-query';
import { fetchQaReviewById } from '../qaReviews.service.js';
import { qaReviewsKeys } from './useQaReviews.js';

/**
 * @param {string|undefined} id
 * @param {{ includeCorrective?: boolean }} [opts]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useQaReview(id, opts = {}, options = {}) {
  const includeCorrective = Boolean(opts.includeCorrective);
  return useQuery({
    queryKey: qaReviewsKeys.detail(id, { includeCorrective }),
    queryFn: () => fetchQaReviewById(id, { include_corrective: includeCorrective }),
    enabled: Boolean(id),
    ...options,
  });
}
