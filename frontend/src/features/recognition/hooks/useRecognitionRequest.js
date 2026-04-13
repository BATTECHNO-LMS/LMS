import { useQuery } from '@tanstack/react-query';
import { fetchRecognitionRequestById } from '../recognitionRequests.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRecognitionRequest(id, options = {}) {
  return useQuery({
    queryKey: recognitionKeys.detail(id),
    queryFn: () => fetchRecognitionRequestById(id),
    enabled: Boolean(id),
    ...options,
  });
}
