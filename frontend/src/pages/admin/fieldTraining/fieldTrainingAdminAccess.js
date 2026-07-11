import { ROLES } from '../../../constants/roles.js';

/** Roles allowed to manage Field Training operations under /admin/field-training. */
export const FIELD_TRAINING_ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.PROGRAM_ADMIN,
  ROLES.UNIVERSITY_ADMIN,
];

export function userHasFieldTrainingAdminRole(user) {
  if (!user || typeof user !== 'object') return false;
  const codes =
    Array.isArray(user.roles) && user.roles.length
      ? user.roles.map(String)
      : user.role
        ? [String(user.role)]
        : [];
  return codes.some((code) => FIELD_TRAINING_ADMIN_ROLES.includes(code));
}
