const crypto = require('crypto');
const { env } = require('../config/env');
const { getOtpPepper } = require('./emailOtp');

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordResetToken(token, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return crypto
    .createHmac('sha256', getOtpPepper())
    .update(`reset:${normalizedEmail}:${token}`)
    .digest('hex');
}

function verifyPasswordResetToken(token, email, tokenHash) {
  if (!token || !tokenHash || !email) return false;
  const computed = hashPasswordResetToken(token, email);
  try {
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(String(tokenHash), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getPasswordResetOtpExpiryDate(from = new Date()) {
  const ms = env.PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60 * 1000;
  return new Date(from.getTime() + ms);
}

function getPasswordResetTokenExpiryDate(from = new Date()) {
  const ms = env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;
  return new Date(from.getTime() + ms);
}

function isPasswordResetResendCooldownActive(lastSentAt, now = new Date()) {
  if (!lastSentAt) return false;
  const elapsedMs = now.getTime() - new Date(lastSentAt).getTime();
  return elapsedMs < env.PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS * 1000;
}

function passwordResetResendCooldownRemainingSeconds(lastSentAt, now = new Date()) {
  if (!lastSentAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastSentAt).getTime();
  const remaining = env.PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

module.exports = {
  generatePasswordResetToken,
  hashPasswordResetToken,
  verifyPasswordResetToken,
  getPasswordResetOtpExpiryDate,
  getPasswordResetTokenExpiryDate,
  isPasswordResetResendCooldownActive,
  passwordResetResendCooldownRemainingSeconds,
};
