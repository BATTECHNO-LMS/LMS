import { createContext, useContext } from 'react';
import { useLandingStats } from './hooks/useLandingStats.js';

/** @typedef {import('./landingStats.service.js').LandingStatsData} LandingStatsData */

/** @type {import('react').Context<{ stats: LandingStatsData | null, isLoading: boolean, error: Error | null } | null>} */
const LandingStatsContext = createContext(null);

/** Fetches landing stats once per page load (shared by hero + phone mockup). */
export function LandingStatsProvider({ children }) {
  const value = useLandingStats();
  return <LandingStatsContext.Provider value={value}>{children}</LandingStatsContext.Provider>;
}

export function useLandingStatsContext() {
  const ctx = useContext(LandingStatsContext);
  if (!ctx) {
    throw new Error('useLandingStatsContext must be used within LandingStatsProvider');
  }
  return ctx;
}
