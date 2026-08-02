'use strict';

const { ApiError } = require('./apiError');
const { isSystemWideAdmin } = require('./universityScope');

/**
 * Resolve organization filter from DB-backed requester context.
 * Never trust client-provided organizationId for authorization.
 *
 * @param {{ isGlobal?: boolean, organizationId?: string | null }} requester
 * @param {string | undefined | null} requestedOrganizationId
 * @returns {string | undefined}
 */
function resolveOrganizationIdFilter(requester, requestedOrganizationId) {
  if (isSystemWideAdmin(requester)) {
    return requestedOrganizationId || undefined;
  }

  const orgId = requester?.organizationId;
  if (requestedOrganizationId && orgId && String(requestedOrganizationId) !== String(orgId)) {
    throw new ApiError(403, 'Forbidden: cannot access another organization');
  }
  if (requestedOrganizationId && !orgId) {
    throw new ApiError(403, 'Forbidden');
  }
  return orgId || undefined;
}

/**
 * @param {{ isGlobal?: boolean, organizationId?: string | null }} requester
 * @param {string | null | undefined} recordOrganizationId
 */
function assertOrganizationAccess(requester, recordOrganizationId) {
  if (isSystemWideAdmin(requester)) return;
  const orgId = requester?.organizationId;
  if (!orgId) {
    throw new ApiError(403, 'Forbidden');
  }
  if (!recordOrganizationId || String(recordOrganizationId) !== String(orgId)) {
    throw new ApiError(403, 'Forbidden');
  }
}

/**
 * @param {{ organizationType?: string | null }} requester
 * @param {'UNIVERSITY'|'INSTITUTION'} expected
 */
function requireOrganizationType(requester, expected) {
  if (requester?.isGlobal) return;
  if (requester?.organizationType !== expected) {
    throw new ApiError(403, 'Forbidden: portal organization type mismatch');
  }
}

function denyAllWhere() {
  return { id: { in: [] } };
}

module.exports = {
  resolveOrganizationIdFilter,
  assertOrganizationAccess,
  requireOrganizationType,
  denyAllWhere,
  isSystemWideAdmin,
};
