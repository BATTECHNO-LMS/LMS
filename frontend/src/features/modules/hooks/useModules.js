import { useQuery } from '@tanstack/react-query';
import { fetchModules } from '../modules.service.js';

export const modulesKeys = {
  all: ['modules'],
  list: (params) => [...modulesKeys.all, 'list', params],
};

export function useModules(params = {}, options = {}) {
  return useQuery({
    queryKey: modulesKeys.list(params),
    queryFn: () => fetchModules(params),
    staleTime: 60_000,
    ...options,
  });
}
