import { useQuery } from '@tanstack/react-query';
import { fetchCertificatesList } from '../certificates.service.js';
import { certificatesKeys } from './certificatesQueryKeys.js';

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCertificates(params = {}, options = {}) {
  return useQuery({
    queryKey: certificatesKeys.list(params),
    queryFn: () => fetchCertificatesList(params),
    ...options,
  });
}
