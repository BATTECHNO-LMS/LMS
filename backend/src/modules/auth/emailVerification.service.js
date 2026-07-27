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

const GENERIC_OTP_ERROR = messageForCode(AUTH_ERROR_CODES.INVALID_OTP);
const RESEND_SUCCESS = 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.';
const RESEND_GENERIC_SUCCESS = 'إذا كان البريد مسجلاً لدينا، سيتم إرسال رمز تحقق جديد.';
const ALREADY_VERIFIED = 'البريد الإلكتروني موثّق مسبقًا.';

async function issueEmailVerificationOtp(user) {
  const email = String(user.email).trim().toLowerCase();
  const now = new Date();
  const otp = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(otp, email);
  const expiresAt = getOtpExpiryDate(now);

  await prisma.$transaction(async (tx) => {
    await otpRepository.invalidateActiveOtpsForUser(user.id, email, tx);
    await otpRepository.createOtpRecord(
      {
        userId: user.id,
        email,
        codeHash,
        expiresAt,
        lastSentAt: now,
      },
      tx
    );
  });

  await sendEmailVerificationOtp({
    to: email,
    otp,
    userName: user.full_name,
  });

  return { email };
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

  await issueEmailVerificationOtp(user);
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
