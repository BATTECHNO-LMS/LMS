import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { getRememberedPortalLoginPath } from '../../utils/portal.js';
import { getActiveRoleCode, getUserRoleCodes, isSafeBackPath } from '../../utils/authRouting.js';
import { normalizeRoleCodes, ROLES } from '../../constants/roles.js';
import { LoadingSpinner } from './LoadingSpinner.jsx';
import { UnauthorizedPage } from '../permissions/UnauthorizedPage.jsx';

/**
 * Restricts nested routes to allowed roles.
 * Unauthenticated → login (401 path). Authenticated without role → 403 page.
 * Never shows 403 while auth context is still loading.
 * Institution trainees hitting university student shells are redirected safely.
 */
export function RoleBasedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search || ''}`;

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={getRememberedPortalLoginPath()}
        replace
        state={{
          from: location,
          returnTo: isSafeBackPath(returnTo) ? returnTo : undefined,
        }}
      />
    );
  }

  const codes = getUserRoleCodes(user);
  if (!codes.length) {
    return <UnauthorizedPage />;
  }

  const allowedSet = new Set(normalizeRoleCodes(allowedRoles));
  const activeRole = getActiveRoleCode(user);
  const path = location.pathname || '';
  // Legacy institution learners may still hold `student` until DB migration finishes.
  const legacyInstitutionLearner =
    allowedSet.has(ROLES.TRAINEE) &&
    user.organizationType === 'INSTITUTION' &&
    codes.includes(ROLES.STUDENT);
  const allowed = codes.some((r) => allowedSet.has(r)) || legacyInstitutionLearner;

  // Institution trainee must not remain on university student shell routes.
  if (
    user.organizationType === 'INSTITUTION' &&
    (activeRole === ROLES.TRAINEE || codes.includes(ROLES.TRAINEE)) &&
    /^\/student(\/|$)/.test(path)
  ) {
    if (/^\/student\/training-programs\/?$/.test(path.replace(/\/+$/, '') || '/')) {
      return <Navigate to="/trainee/courses" replace />;
    }
    return <Navigate to="/trainee" replace />;
  }

  // University student must not use trainee shell.
  if (
    user.organizationType === 'UNIVERSITY' &&
    (activeRole === ROLES.STUDENT || codes.includes(ROLES.STUDENT)) &&
    /^\/trainee(\/|$)/.test(path)
  ) {
    return <Navigate to="/student/dashboard" replace />;
  }

  if (!allowed) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
