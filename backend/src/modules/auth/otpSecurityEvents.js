'use strict';

/**
 * OTP security events (email verification + password reset). The OTP value, its hash and
 * the reset token are never recorded — only the purpose and attempt counters.
 */

const { recordSecurityEvent } = require('../../shared/security/securityEvents');

/**
 * Wrong code for an existing, unexpired OTP. Emits OTP_FAILED, plus OTP_LOCKED_TEMPORARILY
 * when this attempt exhausts the OTP (a new code must be requested).
 * @param {{ userId: string, otpId: string, purpose: 'EMAIL_VERIFICATION'|'PASSWORD_RESET', attemptsUsed: number, maxAttempts: number }} p
 */
async function recordOtpFailure(p) {
  const base = {
    userId: null,
    subjectUserId: p.userId,
    entityType: 'user',
    entityId: p.userId,
    metadata: { purpose: p.purpose, attemptsUsed: p.attemptsUsed, maxAttempts: p.maxAttempts },
  };
  await recordSecurityEvent({ ...base, eventType: 'OTP_FAILED', outcome: 'FAILED', reason: 'INVALID_OTP' });
  if (p.attemptsUsed >= p.maxAttempts) {
    await recordSecurityEvent({
      ...base,
      eventType: 'OTP_LOCKED_TEMPORARILY',
      outcome: 'BLOCKED',
      reason: 'MAX_ATTEMPTS_REACHED',
      dedupeKey: `${p.purpose}|${p.otpId}`,
    });
  }
}

/** Attempt against an OTP that is already exhausted (deduplicated per OTP). */
async function recordOtpRateLimited(p) {
  await recordSecurityEvent({
    eventType: 'OTP_RATE_LIMITED',
    outcome: 'BLOCKED',
    userId: null,
    subjectUserId: p.userId,
    entityType: 'user',
    entityId: p.userId,
    reason: 'OTP_ATTEMPTS_EXHAUSTED',
    metadata: { purpose: p.purpose, maxAttempts: p.maxAttempts },
    dedupeKey: `${p.purpose}|${p.otpId}`,
  });
}

module.exports = { recordOtpFailure, recordOtpRateLimited };
