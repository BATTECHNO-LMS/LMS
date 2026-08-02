import { ADMIN_ROLE_SET, ROLES, canonicalizeRoleCode } from '../constants/roles.js';

/**
 * @param {{ role?: string } | null | undefined} user
 */
export function getNotificationSettingsPathForUser(user) {
  const role = canonicalizeRoleCode(user?.role);
  if (!role) return '/admin/notification-settings';
  if (role === ROLES.INSTRUCTOR) return '/instructor/notification-settings';
  if (role === ROLES.TRAINER) return '/trainer/notification-settings';
  if (role === ROLES.TRAINEE) return '/trainee/notification-settings';
  if (role === ROLES.STUDENT) return '/student/notification-settings';
  if (role === ROLES.REVIEWER) return '/reviewer/notification-settings';
  if (ADMIN_ROLE_SET.includes(role)) return '/admin/notification-settings';
  return '/admin/notification-settings';
}
