import { useQuery } from '@tanstack/react-query';
import { fetchRegisterUniversitySpecialties } from '../../auth/auth.service.js';

/**
 * @param {string | null | undefined} universityId
 */
export function useUniversitySpecialties(universityId) {
  return useQuery({
    queryKey: ['auth', 'registerUniversitySpecialties', universityId],
    queryFn: () => fetchRegisterUniversitySpecialties(universityId),
    enabled: Boolean(universityId),
    staleTime: 5 * 60 * 1000,
  });
}
