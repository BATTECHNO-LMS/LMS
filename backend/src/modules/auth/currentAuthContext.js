'use strict';

/**
 * Load authoritative authorization identity from the database after JWT verification.
 * JWT roles / universityId / isGlobal are informational only — not used here.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { isGlobalFromRoleRecords } = require('./auth.service');

/**
 * @typedef {{
 *   userId: string,
 *   roles: string[],
 *   universityId: string | null,
 *   isGlobal: boolean,
 * }} AuthRequestUser
 */

/**
 * @param {string} userId
 * @returns {Promise<AuthRequestUser>}
 */
async function loadCurrentAuthContextFromDb(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new ApiError(401, 'Unauthorized', null, 'UNAUTHORIZED');
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
    throw new ApiError(401, 'Unauthorized', null, 'USER_NOT_FOUND');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'Account is inactive or suspended', null, 'ACCOUNT_INACTIVE');
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

  const roles = roleRecords.map((r) => r.code);
  const isGlobal = isGlobalFromRoleRecords(roleRecords);

  return {
    userId: user.id,
    roles,
    universityId: user.primary_university_id ?? null,
    isGlobal,
  };
}

/** @type {(userId: string) => Promise<AuthRequestUser>} */
let activeLoader = loadCurrentAuthContextFromDb;

/**
 * @param {string} userId
 * @returns {Promise<AuthRequestUser>}
 */
function loadCurrentAuthContext(userId) {
  return activeLoader(userId);
}

/**
 * Test-only: replace the DB loader with a mock. Call reset after each suite.
 * @param {(userId: string) => Promise<AuthRequestUser>} fn
 */
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
