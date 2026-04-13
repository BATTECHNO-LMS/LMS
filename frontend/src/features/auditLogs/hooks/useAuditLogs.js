import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogsList } from '../auditLogs.service.js';
import { auditLogsKeys } from './auditLogsQueryKeys.js';

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useAuditLogs(params = {}, options = {}) {
  return useQuery({
    queryKey: auditLogsKeys.list(params),
    queryFn: () => fetchAuditLogsList(params),
    ...options,
  });
}
