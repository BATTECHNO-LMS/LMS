import { useAuth } from '../../features/auth/index.js';
import { hasUiPermission } from '../../utils/rolePermissions.js';

/**
 * Renders children only when the current user has the given UI permission(s).
 * @param {{ permission?: string, anyOf?: string[], children: import('react').ReactNode, fallback?: import('react').ReactNode }} props
 */
export function PermissionGate({ permission, anyOf, children, fallback = null }) {
  const { user } = useAuth();
  const role = user?.role;

  let ok = true;
  if (anyOf?.length) {
    ok = anyOf.some((p) => hasUiPermission(role, p));
  } else if (permission) {
    ok = hasUiPermission(role, permission);
  }

  if (!ok) return fallback;
  return children;
}

/** Alias for readability in JSX action areas. */
export function ActionVisibility(props) {
  return <PermissionGate {...props} />;
}
