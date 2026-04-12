import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * Restricts nested routes to allowed roles — wrong role goes to their dashboard.
 */
function userRoleCodes(user) {
  if (!user || typeof user !== 'object') return [];
  if (Array.isArray(user.roles) && user.roles.length) {
    return user.roles.map(String);
  }
  if (user.role) return [String(user.role)];
  return [];
}

export function RoleBasedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={getLoginPathForCurrentPortal()} replace />;
  }

  const codes = userRoleCodes(user);
  const allowed = codes.some((r) => allowedRoles.includes(r));

  if (!allowed) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
