const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  generateEmailOtpCode,
  hashEmailOtpCode,
  verifyEmailOtpCode,
  getOtpExpiryDate,
  isOtpExpired,
  isResendCooldownActive,
  resendCooldownRemainingSeconds,
  OTP_LENGTH,
} = require('../src/utils/emailOtp');

describe('emailOtp utils', () => {
  test('generateEmailOtpCode returns 6 digits', () => {
    const code = generateEmailOtpCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(code.length, OTP_LENGTH);
  });

  test('hash and verify OTP with timing-safe compare', () => {
    const email = 'student@batuni.edu';
    const otp = '482910';
    const hash = hashEmailOtpCode(otp, email);
    assert.equal(verifyEmailOtpCode(otp, email, hash), true);
    assert.equal(verifyEmailOtpCode('000000', email, hash), false);
    assert.equal(verifyEmailOtpCode(otp, 'other@batuni.edu', hash), false);
  });

  test('getOtpExpiryDate respects configured minutes', () => {
    const from = new Date('2026-07-05T12:00:00.000Z');
    const expires = getOtpExpiryDate(from);
    assert.equal(expires.getTime() - from.getTime(), 10 * 60 * 1000);
  });

  test('isOtpExpired detects expiry', () => {
    const now = new Date('2026-07-05T12:00:00.000Z');
    assert.equal(isOtpExpired(new Date('2026-07-05T11:59:00.000Z'), now), true);
    assert.equal(isOtpExpired(new Date('2026-07-05T12:01:00.000Z'), now), false);
  });

  test('resend cooldown helpers', () => {
    const now = new Date('2026-07-05T12:00:00.000Z');
    const lastSent = new Date('2026-07-05T11:59:30.000Z');
    assert.equal(isResendCooldownActive(lastSent, now), true);
    assert.ok(resendCooldownRemainingSeconds(lastSent, now) > 0);
    assert.equal(isResendCooldownActive(new Date('2026-07-05T11:58:00.000Z'), now), false);
  });
});
