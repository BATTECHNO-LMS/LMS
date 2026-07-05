import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '../settings.service.js';

export const settingsKeys = {
  all: ['settings'],
  current: () => [...settingsKeys.all, 'current'],
};

export function useSettings(options = {}) {
  return useQuery({
    queryKey: settingsKeys.current(),
    queryFn: fetchSettings,
    staleTime: 60_000,
    ...options,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
