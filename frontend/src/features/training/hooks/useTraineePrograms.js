import { useQuery } from '@tanstack/react-query';
import { listMyPrograms } from '../training.service.js';
import { STALE } from '../../../lib/queryDefaults.js';

export const traineeKeys = {
  myPrograms: () => ['trainee', 'my-programs'],
};

export function useTraineePrograms(options = {}) {
  return useQuery({
    queryKey: traineeKeys.myPrograms(),
    queryFn: async () => {
      const data = await listMyPrograms();
      return Array.isArray(data) ? data : [];
    },
    staleTime: STALE.dashboard,
    ...options,
  });
}
