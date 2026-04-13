const { prisma } = require('../config/db');
const { cohortListWhere } = require('./deliveryAccess');

/**
 * Cohort IDs the requester may access for delivery/oversight modules.
 * @param {{ roles?: string[], isGlobal?: boolean, universityId?: string | null, userId?: string }} requester
 * @returns {Promise<string[] | null>} `null` = unrestricted (global); empty array = no cohorts
 */
async function resolveScopedCohortIds(requester) {
  const cw = cohortListWhere(requester);
  if (cw === null) return null;
  const rows = await prisma.cohorts.findMany({ where: cw, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * @param {string[] | null} scopeIds
 * @param {string} cohortId
 */
function cohortIdInScope(scopeIds, cohortId) {
  if (scopeIds === null) return true;
  return scopeIds.includes(cohortId);
}

module.exports = { resolveScopedCohortIds, cohortIdInScope };
