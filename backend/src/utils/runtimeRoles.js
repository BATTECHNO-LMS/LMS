'use strict';

/**
 * Active vs legacy role helpers.
 * Legacy codes are canonicalized via roleCanon; they must not appear in allowlists raw.
 */

const {
  canonicalizeRoleCode,
  normalizeRoleCodes,
  LEGACY_CATALOG_ROLE_CODES,
  isLegacyCatalogRoleCode,
} = require('./roleCanon');

/** @deprecated use LEGACY_CATALOG_ROLE_CODES — kept for older tests */
const PROGRAM_ADMIN_ROLE_CODE = 'program_admin';

const DEPRECATED_RUNTIME_ROLE_CODES = Object.freeze([...LEGACY_CATALOG_ROLE_CODES]);

const deprecatedSet = new Set(DEPRECATED_RUNTIME_ROLE_CODES);

/** @type {Set<string>} */
const warnedAllowlistKeys = new Set();

/**
 * @param {unknown} code
 */
function isDeprecatedRuntimeRole(code) {
  return isLegacyCatalogRoleCode(code);
}

/**
 * Normalize allowlist to canonical codes (maps university_admin → admin, etc.).
 * Emits a one-time warning when legacy codes were present in the source list.
 * @param {unknown} codes
 * @param {string} [allowlistKey]
 * @returns {string[]}
 */
function filterDeprecatedFromRoleAllowlist(codes, allowlistKey = 'role_allowlist') {
  const list = Array.isArray(codes) ? codes : codes == null ? [] : [codes];
  const legacySeen = [];
  for (const raw of list) {
    const code = String(raw || '')
      .trim()
      .toLowerCase();
    if (deprecatedSet.has(code)) legacySeen.push(code);
  }
  const unique = normalizeRoleCodes(list);
  if (legacySeen.length) {
    const key = String(allowlistKey || 'role_allowlist');
    if (!warnedAllowlistKeys.has(key)) {
      warnedAllowlistKeys.add(key);
      // eslint-disable-next-line no-console
      console.warn(
        `[runtimeRoles] Canonicalized legacy role(s) in ${key}: ${[...new Set(legacySeen)].join(', ')} → ${unique.join(', ')}`
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
  canonicalizeRoleCode,
  normalizeRoleCodes,
};
