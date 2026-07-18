'use strict';

/**
 * Phase 1 program_admin deprecation: freeze new assignments via HTTP user APIs.
 * Existing holders keep their DB roles and runtime access until a later migration phase.
 */

const { ApiError } = require('../../utils/apiError');
const { normalizeRoleCodes } = require('./superAdminPrivilegeBoundary');

const DEPRECATED_CODE = 'PROGRAM_ADMIN_DEPRECATED';
const DEPRECATED_MESSAGE = 'program_admin is deprecated and cannot be newly assigned';
const CANONICAL_PROGRAM_ADMIN_ROLE_CODE = 'program_admin';

function getCanonicalProgramAdminRoleCode() {
  return CANONICAL_PROGRAM_ADMIN_ROLE_CODE;
}

/**
 * @param {unknown} codes
 * @param {string} [paCode]
 */
function includesProgramAdminRole(codes, paCode = getCanonicalProgramAdminRoleCode()) {
  return normalizeRoleCodes(codes).includes(paCode);
}

function denyProgramAdminAssignment() {
  throw new ApiError(400, DEPRECATED_MESSAGE, null, DEPRECATED_CODE);
}

/**
 * Reject any explicit role_codes payload that includes program_admin.
 * Omitting role_codes (undefined) preserves current roles — including legacy holders.
 *
 * Global requesters are also blocked: deprecation is a product decision, not a privilege gate.
 *
 * @param {{ requestedRoleCodes?: unknown }} args
 */
function assertProgramAdminNotNewlyAssigned({ requestedRoleCodes } = {}) {
  if (requestedRoleCodes === undefined) return;
  if (includesProgramAdminRole(requestedRoleCodes)) {
    denyProgramAdminAssignment();
  }
}

module.exports = {
  DEPRECATED_CODE,
  DEPRECATED_MESSAGE,
  CANONICAL_PROGRAM_ADMIN_ROLE_CODE,
  getCanonicalProgramAdminRoleCode,
  includesProgramAdminRole,
  assertProgramAdminNotNewlyAssigned,
  denyProgramAdminAssignment,
};
