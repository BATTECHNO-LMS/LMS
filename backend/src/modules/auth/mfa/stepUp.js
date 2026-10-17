'use strict';

/**
 * Step-up authentication for highly sensitive operations.
 * The server decides freshness from the session row (`auth_sessions.mfa_verified_at`),
 * never from client state or JWT claims. Window: MFA_STEP_UP_MAX_AGE_MINUTES.
 */

const { env } = require('../../../config/env');
const { ApiError } = require('../../../utils/apiError');
const { AUTH_ERROR_CODES, messageForCode } = require('../../../utils/authErrorCatalog');
const { isStepUpFresh } = require('./mfaPolicy');

function stepUpRequiredError() {
  return new ApiError(
    403,
    messageForCode(AUTH_ERROR_CODES.STEP_UP_REQUIRED),
    { maxAgeMinutes: env.MFA_STEP_UP_MAX_AGE_MINUTES },
    AUTH_ERROR_CODES.STEP_UP_REQUIRED
  );
}

/** @param {{ mfaVerifiedAt?: Date|string|null }|null|undefined} authUser req.user */
function hasFreshStepUp(authUser, now = new Date()) {
  if (!env.MFA_ENABLED) return true;
  return isStepUpFresh({ mfa_verified_at: authUser?.mfaVerifiedAt ?? null }, now);
}

function assertStepUp(authUser, { now = new Date() } = {}) {
  if (!hasFreshStepUp(authUser, now)) throw stepUpRequiredError();
}

function requireStepUp(req, _res, next) {
  try {
    assertStepUp(req.user);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { assertStepUp, hasFreshStepUp, requireStepUp, stepUpRequiredError };
