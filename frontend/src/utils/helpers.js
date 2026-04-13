import { ADMIN_ROLE_SET, ROLES } from '../constants/roles.js';

const DASHBOARD_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/admin/dashboard',
  [ROLES.PROGRAM_ADMIN]: '/admin/dashboard',
  [ROLES.UNIVERSITY_ADMIN]: '/admin/dashboard',
  [ROLES.ACADEMIC_ADMIN]: '/admin/dashboard',
  [ROLES.QA_OFFICER]: '/admin/dashboard',
  [ROLES.INSTRUCTOR]: '/instructor/dashboard',
  [ROLES.STUDENT]: '/student/dashboard',
  [ROLES.UNIVERSITY_REVIEWER]: '/reviewer/dashboard',
};

/**
 * Default home path after login for a role.
 */
export function getDashboardPathForRole(role) {
  return DASHBOARD_BY_ROLE[role] ?? '/login';
}

export function isAdminRole(role) {
  return ADMIN_ROLE_SET.includes(role);
}

/**
 * Join class names, ignoring falsy values.
 */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
