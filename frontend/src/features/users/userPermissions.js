import { ROLES, normalizeRoleCodes } from '../../constants/roles.js';



/**

 * Super Admin / global can fully manage users.

 * @param {{ role?: string, roles?: string[], isGlobal?: boolean } | null | undefined} user

 */

function userRoleList(user) {

  if (!user) return [];

  if (Array.isArray(user.roles) && user.roles.length) {

    return normalizeRoleCodes(user.roles.map(String));

  }

  if (user.role) return normalizeRoleCodes([String(user.role)]);

  return [];

}



export function canManageUsers(user) {

  if (!user) return false;

  if (user.isGlobal) return true;

  const roles = userRoleList(user);

  return roles.includes(ROLES.SUPER_ADMIN);

}



/**

 * Activate / verify email roles (broader than write).

 */

export function canActivateUsers(user) {

  if (canManageUsers(user)) return true;

  if (!user) return false;

  const roles = userRoleList(user);

  return roles.includes(ROLES.ADMIN);

}



/**

 * Users list readers who may export Excel (Admin / Super Admin).

 * Scoped roles are restricted on the backend.

 */

export function canExportUsers(user) {

  if (canManageUsers(user)) return true;

  if (!user) return false;

  const roles = userRoleList(user);

  return roles.includes(ROLES.ADMIN);

}



/**

 * Can choose "all universities" export scope.

 */

export function canExportAllUniversities(user) {

  return canManageUsers(user);

}


