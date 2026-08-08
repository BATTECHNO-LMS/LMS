'use strict';

/**
 * Block assignment of legacy role codes via HTTP user APIs.
 * Existing holders keep DB rows until migrate-roles --apply.
 */

const { ApiError } = require('../../utils/apiError');
const { LEGACY_CATALOG_ROLE_CODES } = require('../../utils/roleCanon');

const DEPRECATED_CODE = 'LEGACY_ROLE_DEPRECATED';
const DEPRECATED_MESSAGE =
  'This legacy role cannot be newly assigned. Use admin or reviewer instead.';

const legacySet = new Set(LEGACY_CATALOG_ROLE_CODES);

function includesLegacyRole(codes) {
  const list = Array.isArray(codes) ? codes : [];
  return list.some((c) => legacySet.has(String(c || '').trim().toLowerCase()));
}

function denyLegacyRoleAssignment(codes) {
  const found = (Array.isArray(codes) ? codes : [])
    .map((c) => String(c || '').trim().toLowerCase())
    .filter((c) => legacySet.has(c));
  throw new ApiError(400, DEPRECATED_MESSAGE, { legacy_roles: found }, DEPRECATED_CODE);
}

/**
 * Reject any explicit role_codes payload that includes legacy catalog roles.
 * @param {{ requestedRoleCodes?: unknown }} args
 */
function assertProgramAdminNotNewlyAssigned({ requestedRoleCodes } = {}) {
  if (requestedRoleCodes === undefined) return;
  if (includesLegacyRole(requestedRoleCodes)) {
    denyLegacyRoleAssignment(requestedRoleCodes);
  }
}

module.exports = {
  DEPRECATED_CODE,
  DEPRECATED_MESSAGE,
  CANONICAL_PROGRAM_ADMIN_ROLE_CODE: 'program_admin',
  getCanonicalProgramAdminRoleCode: () => 'program_admin',
  includesProgramAdminRole: includesLegacyRole,
  assertProgramAdminNotNewlyAssigned,
  denyProgramAdminAssignment: () => denyLegacyRoleAssignment(['program_admin']),
};
