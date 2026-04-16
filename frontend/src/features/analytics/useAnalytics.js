import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsOverview } from './analytics.service.js';

const defaultFilters = {
  universityId: '',
  trackId: '',
  microCredentialId: '',
  cohortId: '',
  timePreset: 'last30',
  from: '',
  to: '',
};

export function useAnalytics() {
  const [filters, setFilters] = useState(defaultFilters);
  const query = useQuery({
    queryKey: ['analytics', 'overview', filters],
    queryFn: () => fetchAnalyticsOverview(filters),
    staleTime: 30_000,
  });

  const setTimePreset = useCallback((timePreset) => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from = '';
    if (timePreset === 'last7') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
    } else if (timePreset === 'last30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
    } else if (timePreset === 'thisYear') {
      from = `${now.getFullYear()}-01-01`;
    } else if (timePreset === 'thisTerm') {
      from = `${now.getFullYear()}-${now.getMonth() < 6 ? '01' : '07'}-01`;
    }
    setFilters((f) => ({ ...f, timePreset, from, to: timePreset === 'all' ? '' : to }));
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const timePresets = useMemo(() => ['last7', 'last30', 'thisTerm', 'thisYear', 'all'], []);

  return {
    filters,
    setFilter,
    setTimePreset,
    resetFilters,
    timePresets,
    data: query.data,
    loading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: query.refetch,
  };
}
