import { normalizeRoleCodes, ROLES } from '../constants/roles.js';

function roleCodes(user) {
  const raw = Array.isArray(user?.roles) && user.roles.length ? user.roles : user?.role ? [user.role] : [];
  return normalizeRoleCodes(raw.map(String));
}

/** Aligned with backend CERTIFICATE_WRITE_ROLE_CODES default. */
export function canWriteCertificate(user) {
  return roleCodes(user).some((r) => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(r));
}
