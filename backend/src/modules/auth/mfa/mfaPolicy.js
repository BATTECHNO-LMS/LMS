'use strict';

/**
 * Single source of truth for "who must use MFA" and "is this session's assurance fresh".
 * Controllers/services never compare role names themselves.
 */

const { env } = require('../../../config/env');
const { canonicalizeRoleCode, normalizeRoleCodes } = require('../../../utils/roleCanon');

function requiredRoleSet() {
  return new Set(normalizeRoleCodes(env.MFA_REQUIRED_ROLE_CODES));
}

/**
 * Effective role codes of a user: platform roles plus active organization-assignment roles
 * (an institution administrator may hold `admin` only through an assignment).
 * @param {{ roles?: string[], assignmentRoleCodes?: string[] }} subject
 */
function effectiveRoleCodes(subject = {}) {
  const fromAssignments = (subject.assignmentRoleCodes || []).map(canonicalizeRoleCode).filter(Boolean);
  return normalizeRoleCodes([...(subject.roles || []), ...fromAssignments]);
}

/** @param {{ roles?: string[], assignmentRoleCodes?: string[], isGlobal?: boolean }} subject */
function isMfaRequiredForUser(subject = {}) {
  if (!env.MFA_ENABLED) return false;
  const required = requiredRoleSet();
  if (subject.isGlobal && required.has('super_admin')) return true;
  return effectiveRoleCodes(subject).some((code) => required.has(code));
}

/** Same decision from the request auth context built by the auth middleware. */
function isMfaRequiredForAuthContext(authUser) {
  if (!authUser) return false;
  const assignmentRoleCodes = [
    ...(Array.isArray(authUser._assignmentRows) ? authUser._assignmentRows.map((a) => a.role_code) : []),
    authUser.organizationAssignment?.roleCode,
  ].filter(Boolean);
  return isMfaRequiredForUser({ roles: authUser.roles, assignmentRoleCodes, isGlobal: authUser.isGlobal });
}

const AUTHENTICATION_LEVELS = Object.freeze({ PASSWORD: 'PASSWORD', MFA: 'MFA' });

function stepUpMaxAgeMs() {
  return env.MFA_STEP_UP_MAX_AGE_MINUTES * 60_000;
}

/**
 * Server-side freshness of the current session's MFA proof (login or step-up).
 * @param {{ mfa_verified_at?: Date|string|null }|null} session
 */
function isStepUpFresh(session, now = new Date()) {
  const at = session?.mfa_verified_at ? new Date(session.mfa_verified_at).getTime() : NaN;
  if (!Number.isFinite(at)) return false;
  const age = new Date(now).getTime() - at;
  return age >= -60_000 && age < stepUpMaxAgeMs();
}

function stepUpExpiresAt(session) {
  const at = session?.mfa_verified_at ? new Date(session.mfa_verified_at).getTime() : NaN;
  return Number.isFinite(at) ? new Date(at + stepUpMaxAgeMs()) : null;
}

module.exports = {
  AUTHENTICATION_LEVELS,
  effectiveRoleCodes,
  isMfaRequiredForUser,
  isMfaRequiredForAuthContext,
  isStepUpFresh,
  stepUpExpiresAt,
  stepUpMaxAgeMs,
};
