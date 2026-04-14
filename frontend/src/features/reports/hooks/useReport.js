import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '../reports.service.js';
import { reportsKeys } from './reportsQueryKeys.js';

export function useReport(type, params = {}, options = {}) {
  return useQuery({
    queryKey: reportsKeys.detail(type, params),
    queryFn: () => fetchReport(type, params),
    enabled: Boolean(type) && (options.enabled ?? true),
    ...options,
  });
}
