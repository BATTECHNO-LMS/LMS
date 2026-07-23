import { ADMIN_ROLE_SET, ROLES, canonicalizeRoleCode } from '../constants/roles.js';

/**
 * @param {{ role?: string } | null | undefined} user
 */
export function getNotificationsPathForUser(user) {
  const role = canonicalizeRoleCode(user?.role);
  if (!role) return '/admin/notifications';
  if (role === ROLES.INSTRUCTOR) return '/instructor/notifications';
  if (role === ROLES.STUDENT) return '/student/notifications';
  if (role === ROLES.ACADEMIC_REVIEWER) return '/reviewer/notifications';
  if (ADMIN_ROLE_SET.includes(role)) return '/admin/notifications';
  return '/admin/notifications';
}
