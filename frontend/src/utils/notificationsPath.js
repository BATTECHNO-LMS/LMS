import { ADMIN_ROLE_SET, ROLES } from '../constants/roles.js';

/**
 * @param {{ role?: string } | null | undefined} user
 */
export function getNotificationsPathForUser(user) {
  const role = user?.role;
  if (!role) return '/admin/notifications';
  if (role === ROLES.INSTRUCTOR) return '/instructor/notifications';
  if (role === ROLES.STUDENT) return '/student/notifications';
  if (role === ROLES.UNIVERSITY_REVIEWER) return '/reviewer/notifications';
  if (ADMIN_ROLE_SET.includes(role)) return '/admin/notifications';
  return '/admin/notifications';
}
