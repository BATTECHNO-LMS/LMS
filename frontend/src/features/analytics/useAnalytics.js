import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAnalytics } from './analytics.service.js';
import { TIME_PRESETS } from './analytics.placeholder.js';

const defaultFilters = {
  universityId: '',
  trackId: '',
  microCredentialId: '',
  cohortId: '',
  timePreset: 'last30',
};

export function useAnalytics() {
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAnalytics(filters);
      setData(payload);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const setTimePreset = useCallback((timePreset) => {
    setFilters((f) => ({ ...f, timePreset: TIME_PRESETS.includes(timePreset) ? timePreset : 'last30' }));
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const timePresets = useMemo(() => TIME_PRESETS, []);

  return {
    filters,
    setFilter,
    setTimePreset,
    resetFilters,
    timePresets,
    data,
    loading,
    error,
    refresh: load,
  };
}
