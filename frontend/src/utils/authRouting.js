import { pickPrimaryRole } from '../features/auth/authUserMapper.js';
import { ROLES, canonicalizeRoleCode, normalizeRoleCodes } from '../constants/roles.js';
import { getDashboardPathForRole } from './helpers.js';

/**
 * Central role → home dashboard map (official routes only).
 * Prefer {@link getRoleHomePath} / {@link getDefaultDashboardPath} over hardcoding paths.
 */
export const ROLE_HOME_ROUTES = Object.freeze({
  [ROLES.SUPER_ADMIN]: '/admin/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
  [ROLES.INSTRUCTOR]: '/instructor/dashboard',
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.REVIEWER]: '/reviewer/dashboard',
});

const ROLE_LABELS_AR = Object.freeze({
  [ROLES.SUPER_ADMIN]: 'سوبر أدمن',
  [ROLES.ADMIN]: 'مسؤول',
  [ROLES.INSTRUCTOR]: 'مدرس',
  [ROLES.STUDENT]: 'طالب',
  [ROLES.REVIEWER]: 'مراجع الجامعة',
});

/**
 * @param {{ role?: string, roles?: string[] } | null | undefined} user
 * @returns {string[]}
 */
export function getUserRoleCodes(user) {
  if (!user || typeof user !== 'object') return [];
  if (Array.isArray(user.roles) && user.roles.length) {
    return normalizeRoleCodes(user.roles.map(String));
  }
  if (user.role) return normalizeRoleCodes([String(user.role)]);
  return [];
}

/**
 * Active / primary role for UI labels and default dashboard.
 * @param {{ role?: string, roles?: string[], activeRole?: string } | null | undefined} user
 */
export function getActiveRoleCode(user) {
  if (!user) return null;
  if (user.activeRole) {
    const active = canonicalizeRoleCode(user.activeRole);
    const codes = getUserRoleCodes(user);
    if (active && codes.includes(active)) return active;
  }
  if (user.role) {
    const primary = canonicalizeRoleCode(user.role);
    if (primary) return primary;
  }
  return pickPrimaryRole(getUserRoleCodes(user));
}

/**
 * Home path for a single official role code.
 * @param {string | null | undefined} role
 */
export function getRoleHomePath(role) {
  const code = canonicalizeRoleCode(role);
  if (!code) return '/login';
  return ROLE_HOME_ROUTES[code] || getDashboardPathForRole(code) || '/login';
}

/**
 * Home route after authentication — uses active/primary role when multiple roles exist.
 * @param {{ role?: string, roles?: string[], activeRole?: string } | null | undefined} user
 */
export function getDefaultDashboardPath(user) {
  if (!user || typeof user !== 'object') return '/login';
  const role = getActiveRoleCode(user);
  if (!role) return '/login';
  return getRoleHomePath(role);
}

/**
 * Arabic label for display on forbidden page (never technical codes alone).
 * @param {string | null | undefined} role
 */
export function getRoleLabelAr(role) {
  const code = canonicalizeRoleCode(role);
  return ROLE_LABELS_AR[code] || (code ? String(code) : 'غير محدد');
}

/**
 * Shell role implied by pathname (/student|instructor|reviewer/...).
 * @param {string} pathname
 * @returns {'student'|'instructor'|'reviewer'|null}
 */
export function getShellRoleFromPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  if (/^\/student(\/|$)/.test(path)) return ROLES.STUDENT;
  if (/^\/instructor(\/|$)/.test(path)) return ROLES.INSTRUCTOR;
  if (/^\/reviewer(\/|$)/.test(path)) return ROLES.REVIEWER;
  if (/^\/admin(\/|$)/.test(path)) return null;
  return null;
}

/**
 * Role to use for UI permission matrix on a path.
 * Prefer the shell role when the user actually holds it (fixes multi-role false 403).
 * @param {{ role?: string, roles?: string[] } | null | undefined} user
 * @param {string} pathname
 */
export function resolveAccessRoleForPath(user, pathname) {
  const shell = getShellRoleFromPath(pathname);
  const codes = getUserRoleCodes(user);
  if (shell && codes.includes(shell)) return shell;
  return getActiveRoleCode(user);
}

/**
 * Whether browser history back is a safe in-app navigation (not login/unauthorized loops).
 * @param {string | undefined} referrerPathname from location.state.from or document.referrer path
 */
export function isSafeBackPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/login' || path.startsWith('/login/')) return false;
  if (path === '/unauthorized' || path === '/forbidden') return false;
  if (path.startsWith('/register') || path.startsWith('/verify-') || path.startsWith('/forgot-')) {
    return false;
  }
  if (path.startsWith('/account-status') || path.startsWith('/reset-password')) return false;
  return (
    path.startsWith('/admin') ||
    path.startsWith('/student') ||
    path.startsWith('/instructor') ||
    path.startsWith('/reviewer')
  );
}
