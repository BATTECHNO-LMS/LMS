import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchCommandCenterOverview,
  fetchCommandCenterFilters,
  fetchCommandCenterLive,
  commandCenterLiveUrl,
} from './commandCenter.service.js';

const FILTER_KEYS = [
  'period',
  'organizationType',
  'organizationId',
  'universityId',
  'opportunityId',
  'role',
  'dateFrom',
  'dateTo',
  'orgMetric',
];

function readFilters(searchParams) {
  const period = searchParams.get('period') || '30d';
  return {
    period,
    organizationType: searchParams.get('organizationType') || '',
    organizationId: searchParams.get('organizationId') || '',
    universityId: searchParams.get('universityId') || '',
    opportunityId: searchParams.get('opportunityId') || '',
    role: searchParams.get('role') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    orgMetric: searchParams.get('orgMetric') || 'activeUsers',
  };
}

export function useCommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [live, setLive] = useState(null);
  const [liveStatus, setLiveStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams);
      if (!value) next.delete(key);
      else next.set(key, value);
      if (key === 'period' && value !== 'custom') {
        next.delete('dateFrom');
        next.delete('dateTo');
      }
      if (key === 'organizationId') next.delete('universityId');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearOrganization = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('organizationId');
    next.delete('universityId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const overviewQuery = useQuery({
    queryKey: ['analytics', 'command-center', filters],
    queryFn: () => fetchCommandCenterOverview(filters),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    // Historical overview keeps its own refresh only while the live stream is down.
    refetchInterval: liveStatus === 'sse' ? false : 30_000,
  });

  const filtersQuery = useQuery({
    queryKey: ['analytics', 'command-center-filters', filters.organizationType, filters.organizationId],
    queryFn: () => fetchCommandCenterFilters(filters),
    staleTime: 60_000,
  });

  const liveQuery = useQuery({
    queryKey: ['analytics', 'command-center-live', filters],
    queryFn: () => fetchCommandCenterLive(filters),
    staleTime: 8_000,
    refetchInterval: liveStatus === 'sse' ? false : 30_000,
  });

  useEffect(() => {
    if (overviewQuery.data?.generatedAt) setLastUpdated(overviewQuery.data.generatedAt);
  }, [overviewQuery.data?.generatedAt]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setLiveStatus('polling');
      return undefined;
    }
    let es;
    let backoff = 2000;
    let timer;
    let stopped = false;

    const connect = () => {
      if (stopped || document.hidden) return;
      if (es && es.readyState !== EventSource.CLOSED) return;
      try {
        es?.close();
        es = new EventSource(commandCenterLiveUrl(filters));
        es.addEventListener('snapshot', (event) => {
          try {
            const payload = JSON.parse(event.data);
            setLive(payload);
            setLiveStatus('sse');
            setLastUpdated(payload.generatedAt || new Date().toISOString());
            backoff = 2000;
          } catch {
            /* ignore malformed frames */
          }
        });
        es.addEventListener('auth', () => {
          setLiveStatus('auth');
          es.close();
        });
        es.onerror = () => {
          es.close();
          es = undefined;
          setLiveStatus('polling');
          backoff = Math.min(backoff * 2, 30_000);
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(connect, backoff);
        };
      } catch {
        setLiveStatus('polling');
      }
    };

    const onVis = () => {
      if (document.hidden) {
        es?.close();
        es = undefined;
        if (timer) window.clearTimeout(timer);
        return;
      }
      connect();
    };

    connect();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVis);
      es?.close();
      if (timer) window.clearTimeout(timer);
    };
  }, [filters]);

  useEffect(() => {
    if (liveQuery.data && liveStatus !== 'sse') {
      setLive(liveQuery.data);
      if (liveQuery.data.generatedAt) setLastUpdated(liveQuery.data.generatedAt);
    }
  }, [liveQuery.data, liveStatus]);

  const activeFilterCount = FILTER_KEYS.filter((k) => {
    if (k === 'period' && filters.period === '30d') return false;
    if (k === 'orgMetric' && filters.orgMetric === 'activeUsers') return false;
    return Boolean(filters[k]);
  }).length;

  return {
    filters,
    setFilter,
    clearOrganization,
    data: overviewQuery.data,
    loading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    isError: overviewQuery.isError,
    error: overviewQuery.error,
    refresh: overviewQuery.refetch,
    filterOptions: filtersQuery.data,
    live,
    liveStatus,
    lastUpdated,
    activeFilterCount,
  };
}
