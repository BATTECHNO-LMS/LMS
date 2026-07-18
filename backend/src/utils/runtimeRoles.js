'use strict';

/**
 * Active vs legacy role helpers (program_admin Phase 3).
 * Deprecated roles must never grant runtime authorization.
 */

const PROGRAM_ADMIN_ROLE_CODE = 'program_admin';

/** Roles that must never appear in active AuthZ allowlists. */
const DEPRECATED_RUNTIME_ROLE_CODES = Object.freeze([PROGRAM_ADMIN_ROLE_CODE]);

const deprecatedSet = new Set(DEPRECATED_RUNTIME_ROLE_CODES);

/** @type {Set<string>} */
const warnedAllowlistKeys = new Set();

/**
 * @param {unknown} code
 */
function isDeprecatedRuntimeRole(code) {
  return deprecatedSet.has(String(code || '').trim().toLowerCase());
}

/**
 * Strip deprecated roles from an allowlist. Optionally warn once per allowlist key.
 * @param {unknown} codes
 * @param {string} [allowlistKey] Stable name for de-duplicated warnings (no secrets).
 * @returns {string[]}
 */
function filterDeprecatedFromRoleAllowlist(codes, allowlistKey = 'role_allowlist') {
  const list = Array.isArray(codes) ? codes : codes == null ? [] : [codes];
  const filtered = [];
  const removed = [];
  for (const raw of list) {
    const code = String(raw || '').trim().toLowerCase();
    if (!code) continue;
    if (deprecatedSet.has(code)) {
      removed.push(code);
      continue;
    }
    filtered.push(code);
  }
  const unique = [...new Set(filtered)];
  if (removed.length) {
    const key = String(allowlistKey || 'role_allowlist');
    if (!warnedAllowlistKeys.has(key)) {
      warnedAllowlistKeys.add(key);
      // eslint-disable-next-line no-console
      console.warn(
        `[runtimeRoles] Ignoring deprecated runtime role(s) in ${key}: ${[...new Set(removed)].join(', ')}`
      );
    }
  }
  return unique;
}

/** Test-only: clear warning de-dupe state. */
function resetDeprecatedRoleWarningsForTests() {
  warnedAllowlistKeys.clear();
}

module.exports = {
  PROGRAM_ADMIN_ROLE_CODE,
  DEPRECATED_RUNTIME_ROLE_CODES,
  isDeprecatedRuntimeRole,
  filterDeprecatedFromRoleAllowlist,
  resetDeprecatedRoleWarningsForTests,
};
