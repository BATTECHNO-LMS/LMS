import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogById } from '../auditLogs.service.js';
import { auditLogsKeys } from './auditLogsQueryKeys.js';

/**
 * @param {string | undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useAuditLog(id, options = {}) {
  return useQuery({
    queryKey: auditLogsKeys.detail(id),
    queryFn: () => fetchAuditLogById(id),
    enabled: Boolean(id),
    ...options,
  });
}
