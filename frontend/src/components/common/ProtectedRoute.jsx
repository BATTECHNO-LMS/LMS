import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getRememberedPortalLoginPath } from '../../utils/portal.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { resolveAuthenticatedLandingRoute } from '../../utils/resolveAuthenticatedLandingRoute.js';
import { isSafeBackPath } from '../../utils/authRouting.js';

/**
 * Requires authentication — renders nested routes or redirects to login (401).
 * Account gates (unverified / pending) redirect before protected content.
 * Preserves returnTo / from for post-login redirect (safe internal paths only).
 */
export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search || ''}`;

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={getRememberedPortalLoginPath()}
        replace
        state={{
          from: location,
          returnTo: isSafeBackPath(returnTo) ? returnTo : undefined,
        }}
      />
    );
  }

  const resolution = resolveAuthenticatedLandingRoute(user, {});
  const onAccountGate =
    resolution.kind === 'verify_email' ||
    resolution.kind === 'account_status' ||
    resolution.kind === 'select_organization';

  if (onAccountGate) {
    const alreadyThere =
      location.pathname === resolution.path ||
      location.pathname.startsWith(`${resolution.path}/`) ||
      (resolution.kind === 'verify_email' && location.pathname.startsWith('/verify-email')) ||
      (resolution.kind === 'account_status' && location.pathname.startsWith('/account-status')) ||
      (resolution.kind === 'select_organization' &&
        location.pathname.startsWith('/select-organization'));
    if (!alreadyThere) {
      return <Navigate to={resolution.path} replace />;
    }
  }

  return <Outlet />;
}
