import { ROLES, canonicalizeRoleCode } from '../constants/roles.js';
import { getActiveRoleCode, getUserRoleCodes, isSafeBackPath } from './authRouting.js';
import {
  PORTAL_TYPES,
  SELECT_ORGANIZATION_PATH,
  isPortalMismatch,
  portalMismatchMessageAr,
  resolveDashboardPathForRole,
} from '../constants/portalConfig.js';

/**
 * @typedef {{
 *   kind: 'dashboard' | 'select_organization' | 'verify_email' | 'account_status' | 'login' | 'portals',
 *   path: string,
 *   portalMismatch?: boolean,
 *   mismatchMessageAr?: string,
 *   reason?: string,
 * }} LandingResolution
 */

/**
 * Central post-auth landing resolver. Backend auth context is source of truth.
 *
 * @param {Record<string, unknown> | null | undefined} user
 * @param {{
 *   selectedPortal?: 'UNIVERSITY'|'INSTITUTION'|null,
 *   preferredReturnTo?: string | null,
 *   accountGateCode?: string | null,
 * }} [options]
 * @returns {LandingResolution}
 */
export function resolveAuthenticatedLandingRoute(user, options = {}) {
  const selectedPortal = options.selectedPortal || null;
  const preferredReturnTo =
    typeof options.preferredReturnTo === 'string' && isSafeBackPath(options.preferredReturnTo)
      ? options.preferredReturnTo
      : null;

  if (!user || typeof user !== 'object') {
    return { kind: 'login', path: '/portals', reason: 'no_user' };
  }

  const status = String(user.status || '').toLowerCase();
  const emailVerified = Boolean(user.emailVerified ?? user.email_verified_at ?? user.emailVerifiedAt);

  const gate = options.accountGateCode || null;
  if (
    gate === 'EMAIL_NOT_VERIFIED' ||
    (!emailVerified && status && status !== 'active' && !user.isGlobal)
  ) {
    return {
      kind: 'verify_email',
      path: `/verify-email?email=${encodeURIComponent(String(user.email || ''))}`,
      reason: 'email_unverified',
    };
  }
  if (gate === 'ACCOUNT_PENDING_ACTIVATION' || status === 'inactive') {
    return {
      kind: 'account_status',
      path: '/account-status',
      reason: 'pending_activation',
    };
  }
  if (gate === 'ACCOUNT_REJECTED' || status === 'rejected') {
    return { kind: 'account_status', path: '/account-status', reason: 'rejected' };
  }
  if (gate === 'ACCOUNT_DISABLED' || status === 'suspended' || status === 'disabled') {
    return { kind: 'account_status', path: '/account-status', reason: 'disabled' };
  }

  if (status && status !== 'active' && !user.isGlobal) {
    return { kind: 'account_status', path: '/account-status', reason: `status_${status}` };
  }

  const roles = getUserRoleCodes(user);
  const isGlobal = Boolean(user.isGlobal || roles.includes(ROLES.SUPER_ADMIN));

  if (isGlobal) {
    const path = preferredReturnTo || '/admin/dashboard';
    return { kind: 'dashboard', path, portalMismatch: false, reason: 'super_admin' };
  }

  const assignments = Array.isArray(user.organizationAssignments)
    ? user.organizationAssignments.filter((a) => a && a.isActive !== false)
    : [];

  if (assignments.length > 1 && !user.organizationId) {
    return {
      kind: 'select_organization',
      path: SELECT_ORGANIZATION_PATH,
      reason: 'multiple_assignments',
    };
  }

  if (assignments.length > 1 && user.needsOrganizationSelection) {
    return {
      kind: 'select_organization',
      path: SELECT_ORGANIZATION_PATH,
      reason: 'needs_organization_selection',
    };
  }

  const organizationType =
    user.organizationType === PORTAL_TYPES.INSTITUTION || user.organizationType === PORTAL_TYPES.UNIVERSITY
      ? user.organizationType
      : assignments.length === 1
        ? assignments[0].organizationType
        : null;

  const organizationId = user.organizationId || assignments[0]?.organizationId || null;

  // Role from active assignment when present, else active/primary role
  const assignmentRole = canonicalizeRoleCode(user.organizationAssignment?.roleCode);
  const role =
    (assignmentRole && roles.includes(assignmentRole) ? assignmentRole : null) ||
    getActiveRoleCode(user) ||
    roles[0] ||
    null;

  if (!role) {
    return { kind: 'portals', path: '/portals', reason: 'no_role' };
  }

  if (!organizationId && !isGlobal && role !== ROLES.SUPER_ADMIN) {
    // University users may still have universityId without org assignment row
    if (!user.universityId && !user.primaryUniversityId) {
      return {
        kind: 'account_status',
        path: '/account-status',
        reason: 'no_assignment',
      };
    }
  }

  const dashboard = resolveDashboardPathForRole(role, organizationType, { organizationId });
  const path = preferredReturnTo || dashboard;

  const mismatch = isPortalMismatch(selectedPortal, organizationType);
  return {
    kind: 'dashboard',
    path,
    portalMismatch: mismatch,
    mismatchMessageAr: mismatch ? portalMismatchMessageAr(organizationType) : undefined,
    reason: mismatch ? 'portal_mismatch_redirect' : 'ok',
  };
}

/**
 * Resolve destination for already-authenticated visitors on public auth pages.
 */
export function resolveAuthenticatedPublicPageRedirect(user) {
  return resolveAuthenticatedLandingRoute(user, {});
}
