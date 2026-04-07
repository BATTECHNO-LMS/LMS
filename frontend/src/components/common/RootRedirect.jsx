import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

export function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}
