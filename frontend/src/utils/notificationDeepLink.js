import { ADMIN_ROLE_SET } from '../constants/roles.js';
import { sanitizeReturnTo } from '../features/auth/session/sessionPolicy.js';

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
 * Prefer server-provided `action_url` (safe relative app paths only); fallback to admin heuristics.
 * Protocol-relative (`//evil`) and absolute URLs are rejected.
 * @param {{ type?: string, title?: string, body?: string | null, action_url?: string | null } | null | undefined} notification
 * @param {unknown} user
 * @returns {string | null}
 */
export function getNotificationLink(notification, user) {
  const raw = notification?.action_url;
  if (typeof raw === 'string') {
    const safe = sanitizeReturnTo(raw);
    if (safe) return safe;
  }
  return getAdminNotificationDeepLink(notification, user);
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
