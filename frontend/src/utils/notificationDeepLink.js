import { ADMIN_ROLE_SET } from '../constants/roles.js';

/** Must match backend `notifyAdminsStudentRegistrationPending` title. */
const NEW_STUDENT_REGISTRATION_TITLE = 'New Student Registration';

function userHasAdminShellAccess(user) {
  if (!user || typeof user !== 'object') return false;
  const roles = Array.isArray(user.roles) ? user.roles.map(String) : [];
  if (roles.length) return roles.some((r) => ADMIN_ROLE_SET.includes(r));
  const role = user.role ? String(user.role) : '';
  return Boolean(role && ADMIN_ROLE_SET.includes(role));
}

/**
 * @param {{ type?: string, title?: string, body?: string | null } | null | undefined} notification
 * @param {unknown} user
 * @returns {string | null}
 */
export function getAdminNotificationDeepLink(notification, user) {
  if (!notification || !userHasAdminShellAccess(user)) return null;
  if (notification.type === 'user_pending_activation') {
    return '/admin/users?status=inactive';
  }
  // Fallback when DB has not migrated `notification_type` yet (server stores as `system`).
  if (
    notification.title === NEW_STUDENT_REGISTRATION_TITLE &&
    (notification.type === 'system' || notification.type === 'warning') &&
    String(notification.body || '').includes('requires account activation')
  ) {
    return '/admin/users?status=inactive';
  }
  return null;
}
