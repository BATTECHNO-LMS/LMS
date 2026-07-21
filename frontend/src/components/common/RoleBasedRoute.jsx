import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';
import { normalizeRoleCodes } from '../../constants/roles.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';

/**
 * Restricts nested routes to allowed roles — wrong role goes to their dashboard.
 */
function userRoleCodes(user) {
  if (!user || typeof user !== 'object') return [];
  if (Array.isArray(user.roles) && user.roles.length) {
    return normalizeRoleCodes(user.roles.map(String));
  }
  if (user.role) return normalizeRoleCodes([String(user.role)]);
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
  const allowedSet = new Set(normalizeRoleCodes(allowedRoles));
  const allowed = codes.some((r) => allowedSet.has(r));

  if (!allowed) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return <Outlet />;
}
