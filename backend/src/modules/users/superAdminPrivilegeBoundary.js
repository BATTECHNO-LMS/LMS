'use strict';

/**
 * Central privilege boundary: only trusted global requesters (req.user.isGlobal === true)
 * may assign, remove, or administratively control the canonical super_admin role.
 *
 * Does not key off any specific non-global role name (e.g. program_admin).
 */

const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');

const FORBIDDEN_CODE = 'SUPER_ADMIN_PRIVILEGE_FORBIDDEN';
const FORBIDDEN_MESSAGE = 'Forbidden';

function getCanonicalSuperAdminRoleCode() {
  return String(env.SUPER_ADMIN_ROLE_CODE || 'super_admin').trim().toLowerCase();
}

/**
 * @param {unknown} codes
 * @returns {string[]}
 */
function normalizeRoleCodes(codes) {
  if (codes == null) return [];
  const list = Array.isArray(codes) ? codes : [codes];
  return [...new Set(list.map((c) => String(c).trim().toLowerCase()).filter(Boolean))];
}

/**
 * @param {unknown} codes
 * @param {string} [superCode]
 */
function includesSuperAdminRole(codes, superCode = getCanonicalSuperAdminRoleCode()) {
  return normalizeRoleCodes(codes).includes(superCode);
}

/**
 * Trusted gate uses only `requester.isGlobal` as set by authenticate middleware.
 * A synthetic payload with isGlobal=false and roles:['super_admin'] does NOT pass —
 * unlike middleware, which ORs the SA role into isGlobal before the service runs.
 *
 * @param {{ isGlobal?: boolean } | null | undefined} requester
 */
function isTrustedGlobalRequester(requester) {
  return Boolean(requester?.isGlobal);
}

function denySuperAdminPrivilege() {
  throw new ApiError(403, FORBIDDEN_MESSAGE, null, FORBIDDEN_CODE);
}

/**
 * Enforce role create/replace rules around super_admin membership.
 * @param {{
 *   requester?: { isGlobal?: boolean },
 *   currentRoleCodes?: unknown,
 *   requestedRoleCodes?: unknown,
 * }} args
 * `requestedRoleCodes` undefined means roles are not being changed.
 */
function assertSuperAdminRoleMutationAllowed({
  requester,
  currentRoleCodes = [],
  requestedRoleCodes,
} = {}) {
  if (isTrustedGlobalRequester(requester)) return;
  if (requestedRoleCodes === undefined) return;

  const currentHas = includesSuperAdminRole(currentRoleCodes);
  const nextHas = includesSuperAdminRole(requestedRoleCodes);

  // Add, remove, or rewrite roles while SA is involved.
  if (nextHas || currentHas) {
    denySuperAdminPrivilege();
  }
}

/**
 * Block non-global administrative control of a user who currently holds super_admin.
 * @param {{ isGlobal?: boolean } | null | undefined} requester
 * @param {unknown} targetRoleCodes
 */
function assertSuperAdminAdministrativeControlAllowed(requester, targetRoleCodes) {
  if (isTrustedGlobalRequester(requester)) return;
  if (includesSuperAdminRole(targetRoleCodes)) {
    denySuperAdminPrivilege();
  }
}

module.exports = {
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE,
  getCanonicalSuperAdminRoleCode,
  normalizeRoleCodes,
  includesSuperAdminRole,
  isTrustedGlobalRequester,
  assertSuperAdminRoleMutationAllowed,
  assertSuperAdminAdministrativeControlAllowed,
  denySuperAdminPrivilege,
};
