const crypto = require('crypto');
const { env } = require('../config/env');

const OTP_LENGTH = 6;

function getOtpPepper() {
  const secret = env.JWT_SECRET || '';
  if (secret.length >= 16) return secret;
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured for OTP hashing in production');
  }
  return 'dev-email-otp-pepper-not-for-production';
}

/** @returns {string} 6-digit numeric OTP */
function generateEmailOtpCode() {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, '0');
}

function hashEmailOtpCode(otp, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return crypto.createHmac('sha256', getOtpPepper()).update(`${normalizedEmail}:${otp}`).digest('hex');
}

function verifyEmailOtpCode(otp, email, codeHash) {
  if (!otp || !codeHash || !email) return false;
  const computed = hashEmailOtpCode(otp, email);
  try {
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(String(codeHash), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getOtpExpiryDate(from = new Date()) {
  const ms = env.EMAIL_OTP_EXPIRY_MINUTES * 60 * 1000;
  return new Date(from.getTime() + ms);
}

function isOtpExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

function isResendCooldownActive(lastSentAt, now = new Date()) {
  if (!lastSentAt) return false;
  const elapsedMs = now.getTime() - new Date(lastSentAt).getTime();
  return elapsedMs < env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000;
}

function resendCooldownRemainingSeconds(lastSentAt, now = new Date()) {
  if (!lastSentAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastSentAt).getTime();
  const remaining = env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

module.exports = {
  OTP_LENGTH,
  generateEmailOtpCode,
  hashEmailOtpCode,
  verifyEmailOtpCode,
  getOtpExpiryDate,
  isOtpExpired,
  isResendCooldownActive,
  resendCooldownRemainingSeconds,
};
