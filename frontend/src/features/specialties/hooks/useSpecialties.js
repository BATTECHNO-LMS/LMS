import { useQuery } from '@tanstack/react-query';
import { fetchActiveSpecialties } from '../specialties.service.js';
import { STALE } from '../../../lib/queryDefaults.js';

export function useSpecialties() {
  return useQuery({
    queryKey: ['specialties', 'active'],
    queryFn: fetchActiveSpecialties,
    staleTime: STALE.catalog,
  });
}
