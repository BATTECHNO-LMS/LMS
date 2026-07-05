import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboardStats } from '../dashboard.service.js';

export const dashboardKeys = {
  all: ['dashboard'],
  adminStats: () => [...dashboardKeys.all, 'admin-stats'],
};

export function useAdminDashboardStats(options = {}) {
  return useQuery({
    queryKey: dashboardKeys.adminStats(),
    queryFn: fetchAdminDashboardStats,
    staleTime: 60_000,
    ...options,
  });
}
