import { ROLES } from '../../constants/roles.js';

/**
 * Super Admin can fully manage users (program_admin deprecated — Phase 3).
 * @param {{ role?: string, roles?: string[], isGlobal?: boolean } | null | undefined} user
 */
export function canManageUsers(user) {
  if (!user) return false;
  if (user.isGlobal) return true;
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r).toLowerCase())
    : user.role
      ? [String(user.role).toLowerCase()]
      : [];
  return roles.includes(ROLES.SUPER_ADMIN) || roles.includes('super_admin');
}

/**
 * Activate / verify email roles (broader than write).
 */
export function canActivateUsers(user) {
  if (canManageUsers(user)) return true;
  if (!user) return false;
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r).toLowerCase())
    : user.role
      ? [String(user.role).toLowerCase()]
      : [];
  return (
    roles.includes(ROLES.UNIVERSITY_ADMIN) ||
    roles.includes(ROLES.ACADEMIC_ADMIN) ||
    roles.includes('university_admin') ||
    roles.includes('academic_admin')
  );
}

/**
 * Users list readers who may export Excel (Admin / Super Admin / University Admin).
 * Scoped roles are restricted on the backend.
 */
export function canExportUsers(user) {
  if (canManageUsers(user)) return true;
  if (!user) return false;
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => String(r).toLowerCase())
    : user.role
      ? [String(user.role).toLowerCase()]
      : [];
  return roles.includes(ROLES.UNIVERSITY_ADMIN) || roles.includes('university_admin');
}

/**
 * Can choose "all universities" export scope.
 */
export function canExportAllUniversities(user) {
  return canManageUsers(user);
}
