import { Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { useAuth } from '../../features/auth/index.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

const Home = lazy(() => import('../../pages/Home.jsx').then((mod) => ({ default: mod.Home })));

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
