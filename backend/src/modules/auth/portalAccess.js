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
    return {
      allowed: false,
      reason: 'portal_required',
      matchingOrganizationIds: [],
      details: { code: AUTH_ERROR_CODES.PORTAL_REQUIRED },
    };
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
  if (evaluation.reason === 'portal_required') {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.PORTAL_REQUIRED),
      evaluation.details || null,
      AUTH_ERROR_CODES.PORTAL_REQUIRED
    );
  }
  const accountPortal = evaluation.details?.accountPortal;
  const message =
    accountPortal === 'UNIVERSITY'
      ? messageForCode('PORTAL_MISMATCH_UNIVERSITY')
      : accountPortal === 'INSTITUTION'
        ? messageForCode('PORTAL_MISMATCH_INSTITUTION')
        : messageForCode(AUTH_ERROR_CODES.PORTAL_MISMATCH);
  throw new ApiError(403, message, evaluation.details || null, AUTH_ERROR_CODES.PORTAL_MISMATCH);
}

const UNIVERSITY_PORTAL_ROLES = ['super_admin', 'admin', 'student', 'instructor', 'reviewer'];
const INSTITUTION_PORTAL_ROLES = ['super_admin', 'admin', 'trainer', 'trainee'];

/**
 * Filter an already-loaded auth user to the sticky portal.
 * Super-admin is unchanged except for the portalType stamp.
 */
function applyPortalScope(authUser, portalType) {
  if (!portalType) {
    throw new ApiError(
      401,
      messageForCode(AUTH_ERROR_CODES.PORTAL_REQUIRED),
      null,
      AUTH_ERROR_CODES.PORTAL_REQUIRED
    );
  }
  if (authUser?.isGlobal) {
    return { ...authUser, portalType };
  }
  const allow = portalType === 'UNIVERSITY' ? UNIVERSITY_PORTAL_ROLES : INSTITUTION_PORTAL_ROLES;
  const roles = (authUser.roles || []).filter((r) => allow.includes(r));
  const next = { ...authUser, roles, portalType };
  if (portalType === 'INSTITUTION') {
    next.universityId = null;
    next.primaryUniversityId = null;
    next.university = null;
    if (next.organizationType !== 'INSTITUTION') {
      next.organizationId = null;
      next.organizationType = null;
      next.organization = null;
      next.organizationAssignment = null;
    }
  }
  if (portalType === 'UNIVERSITY' && next.organizationType === 'INSTITUTION') {
    next.organizationId = null;
    next.organizationType = 'UNIVERSITY';
    next.organization = null;
    next.organizationAssignment = null;
  }
  return next;
}

module.exports = {
  evaluatePortalAccess,
  throwIfPortalMismatch,
  applyPortalScope,
  UNIVERSITY_PORTAL_ROLES,
  INSTITUTION_PORTAL_ROLES,
};
