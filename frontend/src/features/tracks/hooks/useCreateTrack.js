import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTrack } from '../tracks.service.js';
import { tracksKeys } from './useTracks.js';

export function useCreateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrack,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tracksKeys.all });
    },
  });
}
