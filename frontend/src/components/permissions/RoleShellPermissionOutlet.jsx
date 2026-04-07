import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import {
  getRouteUiPermission,
  hasUiPermission,
  UI_ROUTE_DENY,
} from '../../utils/rolePermissions.js';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * Enforces UI permission map for each pathname inside student / instructor / reviewer shells.
 */
export function RoleShellPermissionOutlet() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user?.role;

  const perm = getRouteUiPermission(pathname);
  if (perm === UI_ROUTE_DENY || (perm && !hasUiPermission(role, perm))) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
