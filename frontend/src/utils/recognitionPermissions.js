import { normalizeRoleCodes, ROLES } from '../constants/roles.js';

function roleCodes(user) {
  const raw = Array.isArray(user?.roles) && user.roles.length ? user.roles : user?.role ? [user.role] : [];
  return normalizeRoleCodes(raw.map(String));
}

/** Matches backend RECOGNITION_WRITE (no reviewer). */
export function canWriteRecognitionRequest(user) {
  return roleCodes(user).some((r) => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(r));
}

/** Matches backend PATCH /status (includes reviewer). */
export function canPatchRecognitionStatus(user) {
  return roleCodes(user).some((r) =>
    [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACADEMIC_REVIEWER].includes(r)
  );
}
