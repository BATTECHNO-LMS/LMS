import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTrack } from '../tracks.service.js';
import { tracksKeys } from './useTracks.js';

export function useUpdateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateTrack(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: tracksKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: tracksKeys.detail(vars.id) });
    },
  });
}
