import { useAuth } from '../../features/auth/index.js';
import { hasUiPermissionForUser } from '../../utils/rolePermissions.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * Renders children only when the current user has the required UI permission(s).
 * Otherwise shows UnauthorizedPage (for direct URL or role mismatch).
 * Does not deny while auth/roles are still loading.
 */
export function PagePermissionGate({ permission, anyOf, children }) {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  let ok = true;
  if (anyOf?.length) {
    ok = anyOf.some((p) => hasUiPermissionForUser(user, p));
  } else if (permission) {
    ok = hasUiPermissionForUser(user, permission);
  }

  if (!ok) return <UnauthorizedPage />;
  return children;
}
