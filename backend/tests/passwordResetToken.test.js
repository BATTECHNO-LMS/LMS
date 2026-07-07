const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  generatePasswordResetToken,
  hashPasswordResetToken,
  verifyPasswordResetToken,
  getPasswordResetOtpExpiryDate,
  getPasswordResetTokenExpiryDate,
  isPasswordResetResendCooldownActive,
} = require('../src/utils/passwordResetToken');

describe('passwordResetToken utils', () => {
  test('generatePasswordResetToken returns hex string', () => {
    const token = generatePasswordResetToken();
    assert.match(token, /^[a-f0-9]{64}$/);
  });

  test('hash and verify reset token with timing-safe compare', () => {
    const email = 'student@batuni.edu';
    const token = generatePasswordResetToken();
    const hash = hashPasswordResetToken(token, email);
    assert.equal(verifyPasswordResetToken(token, email, hash), true);
    assert.equal(verifyPasswordResetToken('bad-token', email, hash), false);
    assert.equal(verifyPasswordResetToken(token, 'other@batuni.edu', hash), false);
  });

  test('expiry helpers use configured minutes', () => {
    const from = new Date('2026-07-05T12:00:00.000Z');
    const otpExpires = getPasswordResetOtpExpiryDate(from);
    const tokenExpires = getPasswordResetTokenExpiryDate(from);
    assert.equal(otpExpires.getTime() - from.getTime(), 10 * 60 * 1000);
    assert.equal(tokenExpires.getTime() - from.getTime(), 10 * 60 * 1000);
  });

  test('resend cooldown detects active window', () => {
    const now = new Date('2026-07-05T12:00:00.000Z');
    const lastSent = new Date('2026-07-05T11:59:30.000Z');
    assert.equal(isPasswordResetResendCooldownActive(lastSent, now), true);
    assert.equal(isPasswordResetResendCooldownActive(new Date('2026-07-05T11:58:00.000Z'), now), false);
  });
});
