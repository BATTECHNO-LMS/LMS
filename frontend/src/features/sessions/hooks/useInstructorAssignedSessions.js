import { useQuery } from '@tanstack/react-query';
import { fetchInstructorAssignedSessions } from '../sessions.service.js';
import { sessionsKeys } from './useSessions.js';

export function useInstructorAssignedSessions(options = {}) {
  return useQuery({
    queryKey: sessionsKeys.instructorAssigned(),
    queryFn: fetchInstructorAssignedSessions,
    staleTime: 30_000,
    ...options,
  });
}
