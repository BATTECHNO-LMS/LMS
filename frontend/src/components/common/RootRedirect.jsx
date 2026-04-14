import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';

export function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }
  return <Navigate to={getLoginPathForCurrentPortal()} replace />;
}
