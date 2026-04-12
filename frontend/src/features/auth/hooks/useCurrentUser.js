import { useAuth } from './useAuth.js';

/**
 * Read-only view of the authenticated profile (same source as AuthContext).
 * Use `refreshProfile` from `useAuth()` to re-fetch `/api/auth/me`.
 */
export function useCurrentUser() {
  const { user, isAuthReady, refreshProfile, isAuthenticated } = useAuth();
  return {
    user,
    isReady: isAuthReady,
    isAuthenticated,
    refetch: refreshProfile,
  };
}
