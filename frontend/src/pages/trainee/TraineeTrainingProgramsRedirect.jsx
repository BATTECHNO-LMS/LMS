import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { ROLES } from '../../constants/roles.js';
import { getActiveRoleCode, getUserRoleCodes } from '../../utils/authRouting.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { UnauthorizedPage } from '../../components/permissions/UnauthorizedPage.jsx';

/**
 * Compatibility: /student/training-programs
 * - Institution trainee → /trainee/courses
 * - University student → keep university student page (caller should render it)
 * - Otherwise unauthorized / portal mismatch path
 */
export function TraineeTrainingProgramsRedirect({ universityFallback = null }) {
  const { user, isAuthReady, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthReady) return <LoadingSpinner />;
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/institutions/login"
        replace
        state={{ returnTo: `${location.pathname}${location.search || ''}` }}
      />
    );
  }

  const role = getActiveRoleCode(user);
  const codes = getUserRoleCodes(user);
  const isInstitution = user.organizationType === 'INSTITUTION';

  if (isInstitution && (role === ROLES.TRAINEE || codes.includes(ROLES.TRAINEE))) {
    return <Navigate to="/trainee/courses" replace />;
  }

  // Legacy institution student assignment before migration completes.
  if (isInstitution && role === ROLES.STUDENT) {
    return <Navigate to="/trainee/courses" replace />;
  }

  if (!isInstitution && (role === ROLES.STUDENT || codes.includes(ROLES.STUDENT))) {
    return universityFallback || <Navigate to="/student/dashboard" replace />;
  }

  return <UnauthorizedPage />;
}
