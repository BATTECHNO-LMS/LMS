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
    tenantId,
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
    tenantCode: raw.tenantCode != null ? String(raw.tenantCode) : null,
    tenantNameAr: raw.tenantNameAr != null ? String(raw.tenantNameAr) : null,
    tenantNameEn: raw.tenantNameEn != null ? String(raw.tenantNameEn) : null,
  };
}
