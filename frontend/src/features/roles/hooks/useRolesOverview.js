import { useQuery } from '@tanstack/react-query';
import { fetchRolesOverview } from '../roles.service.js';

export const rolesKeys = {
  all: ['roles'],
  overview: () => [...rolesKeys.all, 'overview'],
};

export function useRolesOverview(options = {}) {
  return useQuery({
    queryKey: rolesKeys.overview(),
    queryFn: fetchRolesOverview,
    staleTime: 120_000,
    ...options,
  });
}
