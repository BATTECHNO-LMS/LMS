import { useEffect, useState } from 'react';
import { fetchLandingStats } from '../landingStats.service.js';

/** @typedef {import('./landingStats.service.js').LandingStatsData | null} LandingStatsData */

/** One in-flight request per full page load (avoids StrictMode double-fetch). */
let pageLoadStatsPromise = null;

/**
 * Fetches public landing aggregate stats on mount (increments visits server-side once per page load).
 * @returns {{ stats: LandingStatsData, isLoading: boolean, error: Error | null }}
 */
export function useLandingStats() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!pageLoadStatsPromise) {
      pageLoadStatsPromise = fetchLandingStats();
    }

    pageLoadStatsPromise
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('landing stats failed'));
          setStats(null);
          pageLoadStatsPromise = null;
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, isLoading, error };
}
