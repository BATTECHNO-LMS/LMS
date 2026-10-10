import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { RouteFallback } from './RouteFallback.jsx';
import { resolveAuthenticatedPublicPageRedirect } from '../../utils/resolveAuthenticatedLandingRoute.js';

const Home = lazy(() => import('../../pages/Home.jsx').then((mod) => ({ default: mod.Home })));

export function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated && user) {
    const resolution = resolveAuthenticatedPublicPageRedirect(user);
    return <Navigate to={resolution.path} replace />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Home />
    </Suspense>
  );
}
