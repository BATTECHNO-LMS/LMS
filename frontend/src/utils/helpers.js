import { ADMIN_ROLE_SET, ROLES, canonicalizeRoleCode, isLegacyDeprecatedRole } from '../constants/roles.js';

const DASHBOARD_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/admin/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.INSTRUCTOR]: '/instructor/dashboard',
  [ROLES.TRAINER]: '/instructor/dashboard',
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.TRAINEE]: '/student/dashboard',
  [ROLES.REVIEWER]: '/reviewer/dashboard',
};

/**
 * Default home path after login for a role.
 */
export function getDashboardPathForRole(role) {
  if (isLegacyDeprecatedRole(role)) return '/login';
  const code = canonicalizeRoleCode(role);
  if (!code) return '/login';
  return DASHBOARD_BY_ROLE[code] ?? '/login';
}

export function isAdminRole(role) {
  if (isLegacyDeprecatedRole(role)) return false;
  return ADMIN_ROLE_SET.includes(canonicalizeRoleCode(role));
}

/**
 * Join class names, ignoring falsy values.
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
