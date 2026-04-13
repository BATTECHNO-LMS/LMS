import { useQuery } from '@tanstack/react-query';
import { fetchSessionAttendance } from '../attendance.service.js';

export const attendanceKeys = {
  all: ['attendance'],
  session: (sessionId) => [...attendanceKeys.all, 'session', sessionId],
};

/**
 * @param {string|undefined} sessionId
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useSessionAttendance(sessionId, options = {}) {
  return useQuery({
    queryKey: attendanceKeys.session(sessionId),
    queryFn: () => fetchSessionAttendance(sessionId),
    enabled: Boolean(sessionId),
    ...options,
  });
}
