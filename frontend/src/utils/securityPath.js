import { ADMIN_ROLE_SET, ROLES, canonicalizeRoleCode } from '../constants/roles.js';

const BY_ROLE = {
  [ROLES.INSTRUCTOR]: '/instructor/security',
  [ROLES.TRAINER]: '/trainer/security',
  [ROLES.TRAINEE]: '/trainee/security',
  [ROLES.STUDENT]: '/student/security',
  [ROLES.REVIEWER]: '/reviewer/security',
};

/** "Security & sessions" page inside the user's own portal shell. */
export function getSecurityPathForUser(user) {
  const role = canonicalizeRoleCode(user?.role);
  if (role && BY_ROLE[role]) return BY_ROLE[role];
  if (role && ADMIN_ROLE_SET.includes(role)) return '/admin/security';
  return '/admin/security';
}
