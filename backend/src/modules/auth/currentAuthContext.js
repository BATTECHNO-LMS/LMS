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
const { AUTH_ERROR_CODES, messageForCode } = require('../../utils/authErrorCatalog');

/**
 * Official university scope for non-global users:
 * - `reviewer`: active row in `reviewer_university_assignments` (fallback: primary_university_id)
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

async function loadPermissionCodesForRoleIds(roleIds) {
  if (!roleIds.length) return [];
  const links = await prisma.role_permissions.findMany({
    where: { role_id: { in: roleIds } },
    select: { permission_id: true },
  });
  if (!links.length) return [];
  const permIds = [...new Set(links.map((l) => l.permission_id))];
  const perms = await prisma.permissions.findMany({
    where: { id: { in: permIds } },
    select: { code: true },
  });
  return [...new Set(perms.map((p) => p.code))];
}

/**
 * @param {string} userId
 * @returns {Promise<AuthRequestUser>}
 */
async function loadCurrentAuthContextFromDb(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED),
      null,
      AUTH_ERROR_CODES.UNAUTHORIZED
    );
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      primary_university_id: true,
    },
  });

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

  const links = await prisma.user_roles.findMany({
    where: { user_id: user.id },
    select: { role_id: true },
  });
  const roleIds = links.map((l) => l.role_id);
  const roleRecords = roleIds.length
    ? await prisma.roles.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, code: true, name: true },
      })
    : [];

  const normalizedRecords = normalizeRoleRecords(roleRecords);
  const roles = normalizeRoleCodes(normalizedRecords.map((r) => r.code));
  const isGlobal = isGlobalFromRoleRecords(normalizedRecords);

  const canonicalRoleRows = roles.length
    ? await prisma.roles.findMany({
        where: { code: { in: roles } },
        select: { id: true, code: true },
      })
    : [];
  let permissions = await loadPermissionCodesForRoleIds(canonicalRoleRows.map((r) => r.id));
  if (isGlobal) {
    permissions = [...ALL_PERMISSION_CODES];
  }

  let primaryUniversityId = user.primary_university_id ?? null;
  let reviewerAssignment = null;
  if (roles.includes('reviewer') && !isGlobal) {
    reviewerAssignment = await prisma.reviewer_university_assignments.findFirst({
      where: { reviewer_user_id: user.id, is_active: true },
      orderBy: { assigned_at: 'desc' },
      select: {
        id: true,
        university_id: true,
        assignment_source: true,
        is_active: true,
        assigned_at: true,
      },
    });
    if (reviewerAssignment?.university_id) {
      primaryUniversityId = reviewerAssignment.university_id;
    } else {
      // No active assignment → block university scope (do not grant global access).
      primaryUniversityId = null;
    }
  }

  let university = null;
  if (primaryUniversityId) {
    university = await prisma.universities.findUnique({
      where: { id: primaryUniversityId },
      select: { id: true, name: true },
    });
  }

  const scope = isGlobal
    ? { type: 'global', universityId: null }
    : primaryUniversityId
      ? { type: 'university', universityId: primaryUniversityId }
      : { type: 'none', universityId: null };

  return {
    userId: user.id,
    roles,
    universityId: primaryUniversityId,
    primaryUniversityId,
    university,
    reviewerAssignment,
    scope,
    isGlobal,
    permissions,
  };
}

/** @type {(userId: string) => Promise<AuthRequestUser>} */
let activeLoader = loadCurrentAuthContextFromDb;

function loadCurrentAuthContext(userId) {
  return activeLoader(userId);
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
