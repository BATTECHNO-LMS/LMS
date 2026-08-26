import { useQuery } from '@tanstack/react-query';
import { fetchStudentDashboardSummary } from '../studentDashboard.service.js';
import { STALE } from '../../../lib/queryDefaults.js';

export const studentDashboardKeys = {
  summary: () => ['student', 'dashboard', 'summary'],
};

export function useStudentDashboardSummary(options = {}) {
  return useQuery({
    queryKey: studentDashboardKeys.summary(),
    queryFn: fetchStudentDashboardSummary,
    staleTime: STALE.dashboard,
    ...options,
  });
}
