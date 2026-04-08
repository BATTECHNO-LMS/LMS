import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getLoginPathForCurrentPortal } from '../../utils/portal.js';

/**
 * Requires authentication — renders nested routes or redirects to login.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={getLoginPathForCurrentPortal()} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
