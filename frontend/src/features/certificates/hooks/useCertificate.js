import { useQuery } from '@tanstack/react-query';
import { fetchCertificateById } from '../certificates.service.js';
import { certificatesKeys } from './certificatesQueryKeys.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCertificate(id, options = {}) {
  return useQuery({
    queryKey: certificatesKeys.detail(id),
    queryFn: () => fetchCertificateById(id),
    enabled: Boolean(id),
    ...options,
  });
}
