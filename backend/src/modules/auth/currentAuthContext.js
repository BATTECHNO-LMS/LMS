'use strict';

/**
 * Load authoritative authorization identity from the database after JWT verification.
 * JWT roles / universityId / isGlobal are informational only — not used here.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { isGlobalFromRoleRecords } = require('./auth.service');
const { normalizeRoleCodes, normalizeRoleRecords } = require('../../utils/roleCanon');
const { ALL_PERMISSION_CODES } = require('../../utils/permissionCatalog');
const { applyPortalScope } = require('./portalAccess');
const { AUTH_ERROR_CODES: AUTH_ERROR_CODES, messageForCode: messageForCode } = require('../../utils/authErrorCatalog');
const { getPermissionCodesForRoleIds } = require('./rolePermissionCache');
const { universityIdentityCache, organizationIdentityCache } = require('../../utils/lookupCache');

/**
 * Official university scope for non-global users:
 * - `reviewer`: active row in `reviewer_university_assignments` only (no primary_university_id fallback)
 * - others: `users.primary_university_id`
 * Exposed on the request user as `universityId` (and mirrored as primaryUniversityId).
 *
 * @typedef {{
 *   userId: string,
 *   roles: string[],
 *   universityId: string | null,
 *   primaryUniversityId: string | null,
 *   university: { id: string, name: string } | null,
 *   scope: { type: 'global' | 'university' | 'none', universityId: string | null },
 *   isGlobal: boolean,
 *   permissions: string[],
 * }} AuthRequestUser
 */

const assignmentSelect = {
  id: true,
  organization_id: true,
  role_code: true,
  branch_id: true,
  department_id: true,
  job_title: true,
  employee_number: true,
  organizations: {
    select: { id: true, type: true, name: true, status: true },
  },
};

async function getUniversityIdentity(id) {
  if (!id) return null;
  const cached = universityIdentityCache.get(id);
  if (cached !== undefined) return cached;
  const row = await prisma.universities.findUnique({
    where: { id },
    select: { id: true, name: true, organization_id: true },
  });
  universityIdentityCache.set(id, row);
  return row;
}

async function getOrganizationIdentity(id) {
  if (!id) return null;
  const cached = organizationIdentityCache.get(id);
  if (cached !== undefined) return cached;
  const row = await prisma.organizations.findUnique({
    where: { id },
    select: { id: true, type: true, name: true, status: true },
  });
  organizationIdentityCache.set(id, row);
  return row;
}

async function loadPermissionCodesForRoleIds(roleIds) {
  if (!roleIds.length) return [];
  return getPermissionCodesForRoleIds(prisma, roleIds);
}

/**
 * @param {string} userId
 * @param {{ portalType?: 'UNIVERSITY'|'INSTITUTION'|null }} [options]
 * @returns {Promise<AuthRequestUser>}
 */
async function loadCurrentAuthContextFromDb(userId, options = {}) {
  if (!userId || typeof userId !== 'string') {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED),
      null,
      AUTH_ERROR_CODES.UNAUTHORIZED
    );
  }

  const portalType =
    options.portalType === 'UNIVERSITY' || options.portalType === 'INSTITUTION'
      ? options.portalType
      : null;

  const [user, links, assignmentRows, reviewerAssignment] = await Promise.all([
    prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        primary_university_id: true,
        preferred_organization_id: true,
      },
    }),
    prisma.user_roles.findMany({
      where: { user_id: userId },
      select: { role_id: true },
    }),
    prisma.user_organization_assignments.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { assigned_at: 'desc' },
      select: assignmentSelect,
    }),
    prisma.reviewer_university_assignments.findFirst({
      where: { reviewer_user_id: userId, is_active: true },
      orderBy: { assigned_at: 'desc' },
      select: {
        id: true,
        university_id: true,
        assignment_source: true,
        is_active: true,
        assigned_at: true,
      },
    }),
  ]);

  if (!user) {
    throw new ApiError(401, messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED), null, 'USER_NOT_FOUND');
  }

  if (user.status !== 'active') {
    const code =
      user.status === 'inactive'
        ? AUTH_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION
        : user.status === 'rejected'
          ? AUTH_ERROR_CODES.ACCOUNT_REJECTED
          : user.status === 'suspended'
            ? AUTH_ERROR_CODES.ACCOUNT_DISABLED
            : AUTH_ERROR_CODES.ACCOUNT_INACTIVE;
    throw new ApiError(403, messageForCode(code), null, code);
  }

  const roleIds = links.map((l) => l.role_id);
  const guessedUniversityId = user.primary_university_id ?? null;

  const [roleRecords, guessedUniversity, permissionsFromRoleIds] = await Promise.all([
    roleIds.length
      ? prisma.roles.findMany({
          where: { id: { in: roleIds } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    getUniversityIdentity(guessedUniversityId),
    roleIds.length ? loadPermissionCodesForRoleIds(roleIds) : Promise.resolve([]),
  ]);

  const normalizedRecords = normalizeRoleRecords(roleRecords);
  const roles = normalizeRoleCodes(normalizedRecords.map((r) => r.code));
  const isGlobal = isGlobalFromRoleRecords(normalizedRecords);

  const originalCodes = roleRecords.map((r) => r.code);
  const codesUnchanged =
    roles.length === originalCodes.length && roles.every((c) => originalCodes.includes(c));
  let canonicalRoleRows = roleRecords.map((r) => ({ id: r.id, code: r.code }));
  if (roles.length && !codesUnchanged) {
    canonicalRoleRows = await prisma.roles.findMany({
      where: { code: { in: roles } },
      select: { id: true, code: true },
    });
  }

  let permissions = isGlobal ? [...ALL_PERMISSION_CODES] : permissionsFromRoleIds;
  if (!isGlobal && roles.length && !codesUnchanged) {
    permissions = await loadPermissionCodesForRoleIds(canonicalRoleRows.map((r) => r.id));
  }

  let primaryUniversityId = user.primary_university_id ?? null;
  if (roles.includes('reviewer') && !isGlobal) {
    if (reviewerAssignment?.university_id) {
      primaryUniversityId = reviewerAssignment.university_id;
    } else {
      primaryUniversityId = null;
    }
  }

  let university = null;
  if (primaryUniversityId) {
    university =
      guessedUniversity && guessedUniversity.id === primaryUniversityId
        ? guessedUniversity
        : await getUniversityIdentity(primaryUniversityId);
  }

  const matchingType = (row) =>
    !portalType || row.organizations?.type === portalType || (portalType === 'UNIVERSITY' && isGlobal);
  let organizationAssignment =
    (user.preferred_organization_id &&
      assignmentRows.find(
        (a) => a.organization_id === user.preferred_organization_id && matchingType(a)
      )) ||
    assignmentRows.find((a) => matchingType(a)) ||
    null;
  if (!portalType && !organizationAssignment) {
    organizationAssignment = assignmentRows[0] || null;
  }

  let organizationId =
    organizationAssignment?.organization_id || university?.organization_id || null;
  let organizationType = organizationAssignment?.organizations?.type || null;
  let organization = organizationAssignment?.organizations
    ? {
        id: organizationAssignment.organizations.id,
        type: organizationAssignment.organizations.type,
        name: organizationAssignment.organizations.name,
        status: organizationAssignment.organizations.status,
      }
    : null;

  if (!organization && university?.organization_id) {
    const org = await getOrganizationIdentity(university.organization_id);
    if (org) {
      organizationId = org.id;
      organizationType = org.type;
      organization = org;
    }
  }

  if (roles.includes('reviewer') && !isGlobal && organizationAssignment?.organizations?.type === 'INSTITUTION') {
    organizationId = organizationAssignment.organization_id;
    organizationType = 'INSTITUTION';
    organization = {
      id: organizationAssignment.organizations.id,
      type: 'INSTITUTION',
      name: organizationAssignment.organizations.name,
      status: organizationAssignment.organizations.status,
    };
  }

  const scope = isGlobal
    ? { type: 'global', universityId: null, organizationId: null }
    : organizationType === 'INSTITUTION' && organizationId
      ? { type: 'organization', universityId: null, organizationId }
      : primaryUniversityId
        ? { type: 'university', universityId: primaryUniversityId, organizationId }
        : { type: 'none', universityId: null, organizationId: null };

  const authUser = {
    userId: user.id,
    roles,
    universityId: primaryUniversityId,
    primaryUniversityId,
    university: university ? { id: university.id, name: university.name } : null,
    organizationId,
    organizationType,
    organization,
    organizationAssignment: organizationAssignment
      ? {
          id: organizationAssignment.id,
          organizationId: organizationAssignment.organization_id,
          roleCode: organizationAssignment.role_code,
          branchId: organizationAssignment.branch_id,
          departmentId: organizationAssignment.department_id,
          jobTitle: organizationAssignment.job_title,
          employeeNumber: organizationAssignment.employee_number,
        }
      : null,
    reviewerAssignment,
    scope,
    isGlobal,
    permissions,
  };
  if (!portalType) return authUser;
  return applyPortalScope(authUser, portalType);
}

/** @type {(userId: string) => Promise<AuthRequestUser>} */
let activeLoader = loadCurrentAuthContextFromDb;

function loadCurrentAuthContext(userId, options = {}) {
  return activeLoader(userId, options);
}

function setCurrentAuthContextLoaderForTests(fn) {
  activeLoader = fn;
}

function resetCurrentAuthContextLoaderForTests() {
  activeLoader = loadCurrentAuthContextFromDb;
}

module.exports = {
  loadCurrentAuthContext,
  loadCurrentAuthContextFromDb,
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
};