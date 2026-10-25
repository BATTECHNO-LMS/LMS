'use strict';

const { canonicalizeRoleCode, CANONICAL_ROLE_CODES } = require('../../utils/roleCanon');

/**
 * Aggregate distinct existing users per canonical role.
 * @param {Array<{ user_id: string, code: string }>} rows
 * @returns {Record<string, number>}
 */
function buildCanonicalRoleCountMap(rows) {
  const sets = Object.fromEntries(CANONICAL_ROLE_CODES.map((c) => [c, new Set()]));
  for (const row of rows || []) {
    const code = canonicalizeRoleCode(row.code);
    if (!sets[code]) continue;
    const userId = row.user_id != null ? String(row.user_id) : '';
    if (!userId) continue;
    sets[code].add(userId);
  }
  return Object.fromEntries(CANONICAL_ROLE_CODES.map((c) => [c, sets[c].size]));
}

module.exports = {
  buildCanonicalRoleCountMap,
};
