import { useQuery } from '@tanstack/react-query';
import { fetchTracksList } from '../tracks.service.js';

export const tracksKeys = {
  all: ['tracks'],
  list: (params) => [...tracksKeys.all, 'list', params],
  detail: (id) => [...tracksKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useTracks(params = {}, options = {}) {
  return useQuery({
    queryKey: tracksKeys.list(params),
    queryFn: () => fetchTracksList(params),
    ...options,
  });
}
