import { useQuery } from '@tanstack/react-query';
import { fetchRecognitionDocumentById } from '../recognitionDocuments.service.js';
import { recognitionKeys } from './recognitionQueryKeys.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useRecognitionDocument(id, options = {}) {
  return useQuery({
    queryKey: recognitionKeys.document(id),
    queryFn: () => fetchRecognitionDocumentById(id),
    enabled: Boolean(id),
    ...options,
  });
}
