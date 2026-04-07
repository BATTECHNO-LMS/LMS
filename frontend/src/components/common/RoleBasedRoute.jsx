import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

/**
 * Restricts nested routes to allowed roles — wrong role goes to their dashboard.
 */
export function RoleBasedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return <Outlet />;
}
