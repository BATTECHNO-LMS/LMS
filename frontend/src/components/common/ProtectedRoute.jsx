import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * Requires authentication — renders nested routes or redirects to login (401).
 * Preserves returnTo / from for post-login redirect.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={getLoginPathForCurrentPortal()}
        replace
        state={{
          from: location,
          returnTo: `${location.pathname}${location.search || ''}`,
        }}
      />
    );
  }

  return <Outlet />;
}
