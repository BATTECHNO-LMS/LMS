import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/index.js';
import { canAccessPathWithUiPermissionsForUser } from '../../utils/rolePermissions.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { UnauthorizedPage } from './UnauthorizedPage.jsx';

/**
 * Enforces UI permission map for each pathname inside student / instructor / reviewer shells.
 * Waits for auth hydrate; evaluates multi-role users against the shell role they hold.
 */
export function RoleShellPermissionOutlet() {
  const { pathname } = useLocation();
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!canAccessPathWithUiPermissionsForUser(user, pathname)) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
