import { useQuery } from '@tanstack/react-query';
import { fetchMicroCredentialsList } from '../microCredentials.service.js';

export const microCredentialsKeys = {
  all: ['microCredentials'],
  list: (params) => [...microCredentialsKeys.all, 'list', params],
  detail: (id) => [...microCredentialsKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useMicroCredentials(params = {}, options = {}) {
  return useQuery({
    queryKey: microCredentialsKeys.list(params),
    queryFn: () => fetchMicroCredentialsList(params),
    ...options,
  });
}
