const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const {
  generateEmailOtpCode,
  hashEmailOtpCode,
  verifyEmailOtpCode,
  getOtpExpiryDate,
  isOtpExpired,
  isResendCooldownActive,
  resendCooldownRemainingSeconds,
} = require('../../utils/emailOtp');
const { sendEmailVerificationOtp } = require('../../shared/services/email.service');
const otpRepository = require('./emailVerificationOtp.repository');
const { AUTH_ERROR_CODES, messageForCode } = require('../../utils/authErrorCatalog');
const { recordOtpFailure, recordOtpRateLimited } = require('./otpSecurityEvents');
const { log } = require('../../utils/logger');

const GENERIC_OTP_ERROR = messageForCode(AUTH_ERROR_CODES.INVALID_OTP);
const RESEND_SUCCESS = 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.';
const RESEND_GENERIC_SUCCESS = 'إذا كان البريد مسجلاً لدينا، سيتم إرسال رمز تحقق جديد.';
const ALREADY_VERIFIED = 'البريد الإلكتروني موثّق مسبقًا.';

async function persistEmailVerificationOtp(userId, email, codeHash, expiresAt, lastSentAt) {
  await prisma.$transaction(async (tx) => {
    await otpRepository.invalidateActiveOtpsForUser(userId, email, tx);
    await otpRepository.createOtpRecord(
      {
        userId,
        email,
        codeHash,
        expiresAt,
        lastSentAt,
      },
      tx
    );
  });
}

/**
 * Persist a fresh email-verification OTP, then attempt delivery.
 * Delivery failure must NOT roll back the OTP row (or the already-created user).
 *
 * @param {{ id: string, email: string, full_name?: string }} user
 * @param {{
 *   send?: typeof sendEmailVerificationOtp,
 *   persistOtp?: typeof persistEmailVerificationOtp,
 * }} [options] — injectables for unit tests
 * @returns {Promise<{ email: string, deliveryFailed: boolean }>}
 */
async function issueEmailVerificationOtp(user, options = {}) {
  const send = typeof options.send === 'function' ? options.send : sendEmailVerificationOtp;
  const persistOtp =
    typeof options.persistOtp === 'function' ? options.persistOtp : persistEmailVerificationOtp;
  const email = String(user.email).trim().toLowerCase();
  const now = new Date();
  const otp = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(otp, email);
  const expiresAt = getOtpExpiryDate(now);

  await persistOtp(user.id, email, codeHash, expiresAt, now);

  try {
    await send({
      to: email,
      otp,
      userName: user.full_name,
    });
    return { email, deliveryFailed: false };
  } catch (err) {
    log('error', 'Failed to send verification email', {
      to: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      name: err?.name || null,
      error: String(err?.message || 'unknown').slice(0, 200),
    });
    return { email, deliveryFailed: true };
  }
}

async function verifyEmailOtpForUser(email, otp) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      full_name: true,
      status: true,
      email_verified_at: true,
    },
  });

  if (!user) {
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  if (user.email_verified_at) {
    return {
      emailVerified: true,
      requiresAdminApproval: user.status === 'inactive',
      alreadyVerified: true,
    };
  }

  const record = await otpRepository.findLatestActiveOtp(user.id, normalizedEmail);
  if (!record) {
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  if (isOtpExpired(record.expires_at)) {
    throw new ApiError(400, messageForCode(AUTH_ERROR_CODES.OTP_EXPIRED), null, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (record.attempts_count >= env.EMAIL_OTP_MAX_ATTEMPTS) {
    await recordOtpRateLimited({
      userId: user.id,
      otpId: record.id,
      purpose: 'EMAIL_VERIFICATION',
      maxAttempts: env.EMAIL_OTP_MAX_ATTEMPTS,
    });
    throw new ApiError(
      429,
      messageForCode(AUTH_ERROR_CODES.OTP_RATE_LIMITED),
      null,
      AUTH_ERROR_CODES.OTP_RATE_LIMITED
    );
  }

  const isValid = verifyEmailOtpCode(otp, normalizedEmail, record.code_hash);
  if (!isValid) {
    await otpRepository.incrementOtpAttempts(record.id);
    await recordOtpFailure({
      userId: user.id,
      otpId: record.id,
      purpose: 'EMAIL_VERIFICATION',
      attemptsUsed: (record.attempts_count || 0) + 1,
      maxAttempts: env.EMAIL_OTP_MAX_ATTEMPTS,
    });
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  await prisma.$transaction(async (tx) => {
    await otpRepository.markOtpUsed(record.id, tx);
    await otpRepository.markUserEmailVerified(user.id, tx);
  });

  return {
    emailVerified: true,
    requiresAdminApproval: user.status === 'inactive',
    alreadyVerified: false,
  };
}

async function resendEmailVerificationOtp(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      full_name: true,
      email_verified_at: true,
    },
  });

  if (!user) {
    return { message: RESEND_GENERIC_SUCCESS, sent: false };
  }

  if (user.email_verified_at) {
    throw new ApiError(400, 'البريد الإلكتروني موثّق مسبقًا.', null, AUTH_ERROR_CODES.VALIDATION_ERROR);
  }

  const latest = await otpRepository.findLatestOtpForCooldown(user.id, normalizedEmail);
  if (latest && isResendCooldownActive(latest.last_sent_at)) {
    const seconds = resendCooldownRemainingSeconds(latest.last_sent_at);
    throw new ApiError(
      429,
      messageForCode(AUTH_ERROR_CODES.OTP_RESEND_COOLDOWN),
      { cooldownSeconds: seconds },
      AUTH_ERROR_CODES.OTP_RESEND_COOLDOWN
    );
  }

  const issued = await issueEmailVerificationOtp(user);
  if (issued.deliveryFailed) {
    throw new ApiError(
      503,
      messageForCode(AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED),
      null,
      AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED
    );
  }
  return { message: RESEND_SUCCESS, sent: true };
}

module.exports = {
  issueEmailVerificationOtp,
  verifyEmailOtpForUser,
  resendEmailVerificationOtp,
  GENERIC_OTP_ERROR,
  RESEND_SUCCESS,
  RESEND_GENERIC_SUCCESS,
  ALREADY_VERIFIED,
};
