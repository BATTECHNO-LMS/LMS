import { useQuery } from '@tanstack/react-query';
import { fetchActiveSpecialties } from '../specialties.service.js';

export function useSpecialties() {
  return useQuery({
    queryKey: ['specialties', 'active'],
    queryFn: fetchActiveSpecialties,
    staleTime: 5 * 60 * 1000,
  });
}
