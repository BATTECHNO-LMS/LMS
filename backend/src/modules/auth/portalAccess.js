'use strict';

const { ApiError } = require('../../utils/apiError');
const { AUTH_ERROR_CODES, messageForCode } = require('../../utils/authErrorCatalog');

/**
 * Derive portal eligibility from real active assignments (+ university primary link).
 * @param {{
 *   assignments: Array<{ organization_id: string, organizations?: { type?: string|null, status?: string|null }|null }>,
 *   primaryUniversityId?: string|null,
 *   isGlobal?: boolean,
 * }} input
 * @param {'UNIVERSITY'|'INSTITUTION'|undefined|null} portalType
 */
function evaluatePortalAccess(input, portalType) {
  if (!portalType) {
    return { allowed: true, reason: 'no_portal_context', matchingOrganizationIds: [] };
  }
  if (input.isGlobal) {
    return { allowed: true, reason: 'super_admin', matchingOrganizationIds: [] };
  }

  const active = (input.assignments || []).filter(
    (a) => a?.organizations && String(a.organizations.status || '').toLowerCase() === 'active'
  );
  const institutionIds = active
    .filter((a) => a.organizations.type === 'INSTITUTION')
    .map((a) => a.organization_id);
  const universityIds = active
    .filter((a) => a.organizations.type === 'UNIVERSITY')
    .map((a) => a.organization_id);
  const hasUniversity = universityIds.length > 0 || Boolean(input.primaryUniversityId);
  const hasInstitution = institutionIds.length > 0;

  if (portalType === 'INSTITUTION') {
    if (!hasInstitution) {
      return {
        allowed: false,
        reason: 'university_only',
        matchingOrganizationIds: [],
        details: {
          accountPortal: 'UNIVERSITY',
          loginPath: '/universities/login',
          actionLabelAr: 'الانتقال إلى بوابة الجامعات',
        },
      };
    }
    return { allowed: true, reason: 'institution_match', matchingOrganizationIds: institutionIds };
  }

  if (portalType === 'UNIVERSITY') {
    if (!hasUniversity) {
      return {
        allowed: false,
        reason: 'institution_only',
        matchingOrganizationIds: [],
        details: {
          accountPortal: 'INSTITUTION',
          loginPath: '/institutions/login',
          actionLabelAr: 'الانتقال إلى بوابة المؤسسات',
        },
      };
    }
    return { allowed: true, reason: 'university_match', matchingOrganizationIds: universityIds };
  }

  return { allowed: true, reason: 'unknown_portal', matchingOrganizationIds: [] };
}

function throwIfPortalMismatch(evaluation) {
  if (evaluation.allowed) return;
  const accountPortal = evaluation.details?.accountPortal;
  const message =
    accountPortal === 'UNIVERSITY'
      ? messageForCode('PORTAL_MISMATCH_UNIVERSITY')
      : accountPortal === 'INSTITUTION'
        ? messageForCode('PORTAL_MISMATCH_INSTITUTION')
        : messageForCode(AUTH_ERROR_CODES.PORTAL_MISMATCH);
  throw new ApiError(403, message, evaluation.details || null, AUTH_ERROR_CODES.PORTAL_MISMATCH);
}

module.exports = {
  evaluatePortalAccess,
  throwIfPortalMismatch,
};
