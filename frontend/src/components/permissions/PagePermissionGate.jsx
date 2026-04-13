import { useAuth } from '../../features/auth/index.js';
import { hasUiPermissionForUser } from '../../utils/rolePermissions.js';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * Renders children only when the current user has the required UI permission(s).
 * Otherwise shows UnauthorizedPage (for direct URL or role mismatch).
 */
export function PagePermissionGate({ permission, anyOf, children }) {
  const { user } = useAuth();

  let ok = true;
  if (anyOf?.length) {
    ok = anyOf.some((p) => hasUiPermissionForUser(user, p));
  } else if (permission) {
    ok = hasUiPermissionForUser(user, permission);
  }

  if (!ok) return <UnauthorizedPage />;
  return children;
}
