import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';
import { Home } from '../../pages/Home.jsx';

export function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }
  return <Home />;
}
