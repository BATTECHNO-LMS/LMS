import { useQuery } from '@tanstack/react-query';
import { fetchMySessions } from '../sessions.service.js';

export function useStudentSessions(options = {}) {
  return useQuery({
    queryKey: ['sessions', 'me'],
    queryFn: fetchMySessions,
    ...options,
  });
}
