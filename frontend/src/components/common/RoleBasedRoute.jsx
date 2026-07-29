import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';
import { getUserRoleCodes } from '../../utils/authRouting.js';
import { normalizeRoleCodes } from '../../constants/roles.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { UnauthorizedPage } from '../permissions/UnauthorizedPage.jsx';

/**
 * Restricts nested routes to allowed roles.
 * Unauthenticated → login (401 path). Authenticated without role → 403 page.
 */
export function RoleBasedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={getLoginPathForCurrentPortal()}
        replace
        state={{ from: location, returnTo: `${location.pathname}${location.search || ''}` }}
      />
    );
  }

  const codes = getUserRoleCodes(user);
  if (!codes.length) {
    return <UnauthorizedPage />;
  }

  const allowedSet = new Set(normalizeRoleCodes(allowedRoles));
  const allowed = codes.some((r) => allowedSet.has(r));

  if (!allowed) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
