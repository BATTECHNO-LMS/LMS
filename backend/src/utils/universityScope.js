const { ApiError } = require('./apiError');
const { normalizeRoles } = require('./deliveryAccess');

/**
 * Super Admin (isGlobal) and Program Admin may access all universities.
 * @param {{ isGlobal?: boolean, roles?: string[] }} requester
 */
function isSystemWideAdmin(requester) {
  if (requester?.isGlobal) return true;
  const roles = normalizeRoles(requester?.roles);
  return roles.includes('program_admin');
}

/**
 * Resolve effective university_id filter for list/query endpoints.
 * Non–system-wide users are forced to their JWT universityId.
 * Passing another university_id returns 403.
 *
 * @param {{ isGlobal?: boolean, roles?: string[], universityId?: string | null }} requester
 * @param {string | undefined | null} requestedUniversityId
 * @returns {string | undefined} university_id to apply, or undefined for no university filter (system-wide only)
 */
function resolveUniversityIdFilter(requester, requestedUniversityId) {
  if (isSystemWideAdmin(requester)) {
    return requestedUniversityId || undefined;
  }

  const uni = requester?.universityId;
  if (requestedUniversityId && uni && String(requestedUniversityId) !== String(uni)) {
    throw new ApiError(403, 'Forbidden: cannot access another university');
  }
  if (requestedUniversityId && !uni) {
    throw new ApiError(403, 'Forbidden');
  }

  return uni || undefined;
}

/**
 * Assert a record belongs to the requester's university (or requester is system-wide).
 * @param {{ isGlobal?: boolean, roles?: string[], universityId?: string | null }} requester
 * @param {string | null | undefined} recordUniversityId
 */
function assertUniversityRecordAccess(requester, recordUniversityId) {
  if (isSystemWideAdmin(requester)) return;
  const uni = requester?.universityId;
  if (!uni) {
    throw new ApiError(403, 'Forbidden');
  }
  if (!recordUniversityId || String(recordUniversityId) !== String(uni)) {
    throw new ApiError(403, 'Forbidden');
  }
}

/**
 * Prisma where fragment that matches no rows (safe default when scope is missing).
 */
function denyAllWhere() {
  return { id: { in: [] } };
}

module.exports = {
  isSystemWideAdmin,
  resolveUniversityIdFilter,
  assertUniversityRecordAccess,
  denyAllWhere,
};
