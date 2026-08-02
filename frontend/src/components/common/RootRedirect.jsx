import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { Home } from '../../pages/Home.jsx';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

export function RootRedirect() {
  const { isAuthenticated, user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && user) {
    const resolution = resolveAuthenticatedPublicPageRedirect(user);
    return <Navigate to={resolution.path} replace />;
  }

  return <Home />;
}
