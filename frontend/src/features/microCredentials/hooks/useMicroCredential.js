import { useQuery } from '@tanstack/react-query';
import { fetchMicroCredentialById } from '../microCredentials.service.js';
import { microCredentialsKeys } from './useMicroCredentials.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useMicroCredential(id, options = {}) {
  return useQuery({
    queryKey: microCredentialsKeys.detail(id),
    queryFn: () => fetchMicroCredentialById(id),
    enabled: Boolean(id),
    ...options,
  });
}
