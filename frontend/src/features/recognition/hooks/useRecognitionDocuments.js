import { useQuery } from '@tanstack/react-query';
import { fetchRecognitionDocumentsForRequest } from '../recognitionDocuments.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

/**
 * @param {string | undefined} recognitionRequestId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRecognitionDocuments(recognitionRequestId, options = {}) {
  return useQuery({
    queryKey: recognitionKeys.documents(recognitionRequestId),
    queryFn: () => fetchRecognitionDocumentsForRequest(recognitionRequestId),
    enabled: Boolean(recognitionRequestId),
    ...options,
  });
}
