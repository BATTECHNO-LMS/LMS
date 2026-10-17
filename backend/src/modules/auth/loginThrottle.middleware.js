'use strict';

const { checkLoginAllowed, hashIdentifier } = require('./loginThrottle');
const { getSecurityClientIp } = require('../../shared/security/clientIdentity');
const { recordSecurityEvent } = require('../../shared/security/securityEvents');
const { CREDENTIAL_LIMIT_MESSAGE } = require('../../middlewares/rateLimit.middleware');

/**
 * Runs after body validation on POST /auth/login. While a progressive cooldown is active
 * the request is rejected before the password is checked, with the same response for
 * existing and unknown identifiers.
 */
function loginThrottleGuard(req, res, next) {
  const ip = getSecurityClientIp(req);
  const identifier = String(req.validated?.email || '').trim().toLowerCase();
  const verdict = checkLoginAllowed({ ip, identifier });
  if (!verdict.blocked) return next();
  const idHash = hashIdentifier(identifier);
  recordSecurityEvent({
    eventType: 'RATE_LIMIT_TRIGGERED',
    outcome: 'BLOCKED',
    req,
    userId: null,
    entityType: 'rate_limiter',
    reason: 'login_failure_cooldown',
    metadata: {
      limiter: 'login_failure_cooldown',
      routeGroup: 'auth',
      keyType: verdict.scope,
      retryAfterSeconds: verdict.retryAfterSeconds,
      identifierHash: idHash,
    },
    dedupeKey: `login_failure_cooldown|${verdict.scope}|${ip}|${verdict.scope === 'ip' ? '' : idHash}`,
    dedupeWindowMs: Math.max(verdict.retryAfterSeconds, 30) * 1000,
  });
  res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
  return res.status(429).json({
    ...CREDENTIAL_LIMIT_MESSAGE,
    details: { retryAfterSeconds: verdict.retryAfterSeconds },
  });
}

module.exports = { loginThrottleGuard };
