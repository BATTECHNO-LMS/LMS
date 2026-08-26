import { useQuery } from '@tanstack/react-query';
import { getTrainerDashboard } from '../trainer.service.js';
import { STALE } from '../../../lib/queryDefaults.js';

export const trainerKeys = {
  dashboard: () => ['trainer', 'dashboard'],
};

export function useTrainerDashboard(options = {}) {
  return useQuery({
    queryKey: trainerKeys.dashboard(),
    queryFn: getTrainerDashboard,
    staleTime: STALE.dashboard,
    ...options,
  });
}
