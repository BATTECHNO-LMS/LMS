import { ADMIN_ROLE_SET, ROLES, canonicalizeRoleCode } from '../constants/roles.js';

const DASHBOARD_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/admin/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.INSTRUCTOR]: '/instructor/dashboard',
  [ROLES.STUDENT]: '/student',
  [ROLES.REVIEWER]: '/reviewer/dashboard',
};

/**
 * Default home path after login for a role.
 */
export function getDashboardPathForRole(role) {
  const code = canonicalizeRoleCode(role);
  if (!code) return '/login';
  return DASHBOARD_BY_ROLE[code] ?? '/login';
}

export function isAdminRole(role) {
  return ADMIN_ROLE_SET.includes(canonicalizeRoleCode(role));
}

/**
 * Join class names, ignoring falsy values.
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
