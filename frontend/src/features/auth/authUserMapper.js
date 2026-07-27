import {
  ADMIN_ROLE_SET,
  ROLES,
  normalizeRoleCodes,
  canonicalizeRoleCode,
} from '../../constants/roles.js';
import { TENANT_SCOPE_ALL } from '../../constants/tenants.js';

/**
 * Official university id for the signed-in user.
 * Source of truth on the API is users.primary_university_id, exposed as universityId.
 * @param {Record<string, unknown> | null | undefined} user
 * @returns {string | null}
 */
export function resolveAuthUniversityId(user) {
  if (!user || typeof user !== 'object') return null;
  const candidates = [
    user.universityId,
    user.primary_university_id,
    user.primaryUniversityId,
    user.scope && typeof user.scope === 'object' ? user.scope.universityId : null,
    user.university && typeof user.university === 'object' ? user.university.id : null,
    user.primary_university && typeof user.primary_university === 'object'
      ? user.primary_university.id
      : null,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

/**
 * Pick a single dashboard role from JWT / profile role codes (priority: admin roles first).
 * @param {string[]} roles
 */
export function pickPrimaryRole(roles) {
  const normalized = normalizeRoleCodes(roles);
  if (!normalized.length) return null;
  for (const code of ADMIN_ROLE_SET) {
    if (normalized.includes(code)) return code;
  }
  if (normalized.includes(ROLES.REVIEWER)) return ROLES.REVIEWER;
  if (normalized.includes(ROLES.INSTRUCTOR)) return ROLES.INSTRUCTOR;
  if (normalized.includes(ROLES.STUDENT)) return ROLES.STUDENT;
  return normalized[0];
}

/**
 * Map backend auth user payload to the shape used by AuthContext / UI.
 * @param {Record<string, unknown>} raw
 */
export function mapAuthUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const roles = normalizeRoleCodes(Array.isArray(raw.roles) ? raw.roles.map(String) : []);
  const role = canonicalizeRoleCode(raw.role) || pickPrimaryRole(roles);
  const isGlobal = Boolean(raw.isGlobal ?? role === ROLES.SUPER_ADMIN);
  const universityId = isGlobal ? null : resolveAuthUniversityId(raw);
  const uniRaw = raw.university ?? raw.primary_university;
  const university =
    uniRaw && typeof uniRaw === 'object' && (uniRaw.name || uniRaw.id)
      ? {
          id: String(uniRaw.id ?? universityId ?? ''),
          name: uniRaw.name != null ? String(uniRaw.name) : '',
        }
      : universityId
        ? { id: universityId, name: '' }
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

  const tenantId = isGlobal ? TENANT_SCOPE_ALL : universityId;
  const scope =
    raw.scope && typeof raw.scope === 'object'
      ? {
          type: String(raw.scope.type || (isGlobal ? 'global' : universityId ? 'university' : 'none')),
          universityId:
            raw.scope.universityId != null
              ? String(raw.scope.universityId)
              : isGlobal
                ? null
                : universityId,
        }
      : isGlobal
        ? { type: 'global', universityId: null }
        : universityId
          ? { type: 'university', universityId }
          : { type: 'none', universityId: null };

  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.full_name ?? raw.name ?? ''),
    full_name: raw.full_name != null ? String(raw.full_name) : String(raw.name ?? ''),
    status: raw.status != null ? String(raw.status) : undefined,
    role,
    roles,
    isGlobal,
    /** Canonical camelCase alias used by reviewer / academic portals. */
    universityId,
    primaryUniversityId: universityId,
    primary_university_id: universityId,
    primary_university: university,
    university,
    scope,
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
