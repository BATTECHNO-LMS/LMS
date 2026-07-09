import { ADMIN_ROLE_SET, ROLES } from '../../constants/roles.js';
import { TENANT_SCOPE_ALL } from '../../constants/tenants.js';

/**
 * Pick a single dashboard role from JWT / profile role codes (priority: admin roles first).
 * @param {string[]} roles
 */
export function pickPrimaryRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  for (const code of ADMIN_ROLE_SET) {
    if (roles.includes(code)) return code;
  }
  if (roles.includes(ROLES.UNIVERSITY_REVIEWER)) return ROLES.UNIVERSITY_REVIEWER;
  if (roles.includes(ROLES.INSTRUCTOR)) return ROLES.INSTRUCTOR;
  if (roles.includes(ROLES.STUDENT)) return ROLES.STUDENT;
  return roles[0];
}

/**
 * Map backend auth user payload to the shape used by AuthContext / UI.
 * @param {Record<string, unknown>} raw
 */
export function mapAuthUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const roles = Array.isArray(raw.roles) ? raw.roles.map(String) : [];
  const role = raw.role ? String(raw.role) : pickPrimaryRole(roles);
  const isGlobal = Boolean(raw.isGlobal ?? role === ROLES.SUPER_ADMIN);
  const primaryUniversityId = raw.primary_university_id != null ? String(raw.primary_university_id) : null;
  const uniRaw = raw.university ?? raw.primary_university;
  const university =
    uniRaw && typeof uniRaw === 'object' && uniRaw.name
      ? { id: String(uniRaw.id ?? primaryUniversityId ?? ''), name: String(uniRaw.name) }
      : null;

  const specialtyRaw = raw.specialty ?? raw.university_specialty ?? raw.canonical_specialty;
  const specialty =
    specialtyRaw && typeof specialtyRaw === 'object'
      ? {
          id: String(specialtyRaw.id ?? ''),
          name_ar: specialtyRaw.name_ar != null ? String(specialtyRaw.name_ar) : undefined,
          name_en: specialtyRaw.name_en != null ? String(specialtyRaw.name_en) : undefined,
          code: specialtyRaw.code != null ? String(specialtyRaw.code) : undefined,
        }
      : null;

  const tenantId = isGlobal ? TENANT_SCOPE_ALL : primaryUniversityId;

  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.full_name ?? raw.name ?? ''),
    full_name: raw.full_name != null ? String(raw.full_name) : String(raw.name ?? ''),
    status: raw.status != null ? String(raw.status) : undefined,
    role,
    roles,
    isGlobal,
    primary_university_id: primaryUniversityId,
    primary_university: university,
    university,
    specialty_id: raw.specialty_id != null ? String(raw.specialty_id) : null,
    university_specialty_id:
      raw.university_specialty_id != null ? String(raw.university_specialty_id) : null,
    specialty,
    tenantId,
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
    tenantCode: raw.tenantCode != null ? String(raw.tenantCode) : null,
    tenantNameAr: raw.tenantNameAr != null ? String(raw.tenantNameAr) : null,
    tenantNameEn: raw.tenantNameEn != null ? String(raw.tenantNameEn) : null,
  };
}
