import { useAuth } from '../../features/auth/index.js';
import { hasUiPermission } from '../../utils/rolePermissions.js';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * Renders children only when the current user has the required UI permission(s).
 * Otherwise shows UnauthorizedPage (for direct URL or role mismatch).
 */
export function PagePermissionGate({ permission, anyOf, children }) {
  const { user } = useAuth();
  const role = user?.role;

  let ok = true;
  if (anyOf?.length) {
    ok = anyOf.some((p) => hasUiPermission(role, p));
  } else if (permission) {
    ok = hasUiPermission(role, permission);
  }

  if (!ok) return <UnauthorizedPage />;
  return children;
}
