import { useQuery } from '@tanstack/react-query';
import { verifyCertificateByCode } from '../certificates.service.js';
import { certificatesKeys } from './certificatesQueryKeys.js';

/**
 * @param {string | undefined} verificationCode
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useVerifyCertificate(verificationCode, options = {}) {
  return useQuery({
    queryKey: certificatesKeys.verify(verificationCode),
    queryFn: () => verifyCertificateByCode(verificationCode),
    enabled: Boolean(verificationCode && verificationCode.length >= 8),
    ...options,
  });
}
