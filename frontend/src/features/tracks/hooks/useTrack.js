import { useQuery } from '@tanstack/react-query';
import { fetchTrackById } from '../tracks.service.js';
import { tracksKeys } from './useTracks.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useTrack(id, options = {}) {
  return useQuery({
    queryKey: tracksKeys.detail(id),
    queryFn: () => fetchTrackById(id),
    enabled: Boolean(id),
    ...options,
  });
}
