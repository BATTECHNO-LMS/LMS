import { useQuery } from '@tanstack/react-query';
import { fetchRecognitionRequestsList } from '../recognitionRequests.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRecognitionRequests(params = {}, options = {}) {
  return useQuery({
    queryKey: recognitionKeys.list(params),
    queryFn: () => fetchRecognitionRequestsList(params),
    ...options,
  });
}
