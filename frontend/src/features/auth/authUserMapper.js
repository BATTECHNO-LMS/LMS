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
  if (normalized.includes(ROLES.TRAINER)) return ROLES.TRAINER;
  if (normalized.includes(ROLES.TRAINEE)) return ROLES.TRAINEE;
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
  const organizationTypeHint =
    raw.organizationType != null
      ? String(raw.organizationType)
      : raw.organization && typeof raw.organization === 'object' && raw.organization.type != null
        ? String(raw.organization.type)
        : null;
  const assignmentRoleHint = canonicalizeRoleCode(
    raw.organizationAssignment && typeof raw.organizationAssignment === 'object'
      ? raw.organizationAssignment.roleCode
      : null
  );
  let role =
    canonicalizeRoleCode(raw.activeRole) ||
    canonicalizeRoleCode(raw.role) ||
    pickPrimaryRole(roles);
  if (organizationTypeHint === 'INSTITUTION') {
    if (assignmentRoleHint === ROLES.TRAINEE || roles.includes(ROLES.TRAINEE)) {
      role = ROLES.TRAINEE;
    } else if (assignmentRoleHint === ROLES.TRAINER || roles.includes(ROLES.TRAINER)) {
      role = ROLES.TRAINER;
    } else if (assignmentRoleHint) {
      role = assignmentRoleHint;
    }
  } else if (organizationTypeHint === 'UNIVERSITY' && roles.includes(ROLES.STUDENT)) {
    if (assignmentRoleHint === ROLES.STUDENT || !roles.includes(ROLES.TRAINEE)) {
      role = canonicalizeRoleCode(raw.role) || ROLES.STUDENT;
    }
  }
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

  const organizationAssignments = Array.isArray(raw.organizationAssignments)
    ? raw.organizationAssignments
        .map((a) => {
          if (!a || typeof a !== 'object') return null;
          return {
            id: a.id != null ? String(a.id) : null,
            organizationId: a.organizationId != null ? String(a.organizationId) : null,
            organizationType: a.organizationType != null ? String(a.organizationType) : null,
            organizationName: a.organizationName != null ? String(a.organizationName) : '',
            organizationLogoUrl: a.organizationLogoUrl != null ? String(a.organizationLogoUrl) : null,
            roleCode: canonicalizeRoleCode(a.roleCode) || null,
            branchId: a.branchId != null ? String(a.branchId) : null,
            branchName: a.branchName != null ? String(a.branchName) : null,
            departmentId: a.departmentId != null ? String(a.departmentId) : null,
            departmentName: a.departmentName != null ? String(a.departmentName) : null,
            jobTitle: a.jobTitle != null ? String(a.jobTitle) : null,
            isActive: a.isActive !== false,
          };
        })
        .filter((a) => a && a.organizationId)
    : [];

  const organizationId =
    raw.organizationId != null
      ? String(raw.organizationId)
      : organizationAssignments[0]?.organizationId || null;
  const organizationType =
    raw.organizationType != null
      ? String(raw.organizationType)
      : organizationAssignments[0]?.organizationType || (universityId ? 'UNIVERSITY' : null);

  const orgRaw = raw.organization;
  const organization =
    orgRaw && typeof orgRaw === 'object'
      ? {
          id: String(orgRaw.id ?? organizationId ?? ''),
          type: orgRaw.type != null ? String(orgRaw.type) : organizationType,
          name: orgRaw.name != null ? String(orgRaw.name) : '',
          status: orgRaw.status != null ? String(orgRaw.status) : undefined,
        }
      : organizationId
        ? { id: organizationId, type: organizationType, name: '' }
        : null;

  const assignmentRaw = raw.organizationAssignment;
  const organizationAssignment =
    assignmentRaw && typeof assignmentRaw === 'object'
      ? {
          id: assignmentRaw.id != null ? String(assignmentRaw.id) : null,
          roleCode: canonicalizeRoleCode(assignmentRaw.roleCode) || null,
          branchId: assignmentRaw.branchId != null ? String(assignmentRaw.branchId) : null,
          departmentId:
            assignmentRaw.departmentId != null ? String(assignmentRaw.departmentId) : null,
          jobTitle: assignmentRaw.jobTitle != null ? String(assignmentRaw.jobTitle) : null,
          employeeNumber:
            assignmentRaw.employeeNumber != null ? String(assignmentRaw.employeeNumber) : null,
        }
      : null;

  const needsOrganizationSelection = Boolean(
    raw.needsOrganizationSelection ||
      (organizationAssignments.length > 1 && !raw.preferredOrganizationId && !raw.organizationId)
  );

  const tenantId = isGlobal ? TENANT_SCOPE_ALL : organizationId || universityId;
  const scope =
    raw.scope && typeof raw.scope === 'object'
      ? {
          type: String(
            raw.scope.type ||
              (isGlobal
                ? 'global'
                : organizationType === 'INSTITUTION'
                  ? 'organization'
                  : universityId
                    ? 'university'
                    : 'none')
          ),
          universityId:
            raw.scope.universityId != null
              ? String(raw.scope.universityId)
              : isGlobal
                ? null
                : universityId,
          organizationId:
            raw.scope.organizationId != null
              ? String(raw.scope.organizationId)
              : isGlobal
                ? null
                : organizationId,
        }
      : isGlobal
        ? { type: 'global', universityId: null, organizationId: null }
        : organizationType === 'INSTITUTION' && organizationId
          ? { type: 'organization', universityId: null, organizationId }
          : universityId
            ? { type: 'university', universityId, organizationId }
            : { type: 'none', universityId: null, organizationId: null };

  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.full_name ?? raw.name ?? ''),
    full_name: raw.full_name != null ? String(raw.full_name) : String(raw.name ?? ''),
    status: raw.status != null ? String(raw.status) : undefined,
    emailVerified: Boolean(raw.email_verified_at || raw.emailVerified || raw.emailVerifiedAt),
    email_verified_at: raw.email_verified_at ?? raw.emailVerifiedAt ?? null,
    role,
    activeRole: role,
    roles,
    isGlobal,
    /** Canonical camelCase alias used by reviewer / academic portals. */
    universityId,
    primaryUniversityId: universityId,
    primary_university_id: universityId,
    primary_university: university,
    university,
    organizationId,
    organizationType,
    organization,
    organizationAssignment,
    organizationAssignments,
    preferredOrganizationId:
      raw.preferredOrganizationId != null ? String(raw.preferredOrganizationId) : null,
    needsOrganizationSelection,
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
