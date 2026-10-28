const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const {
  generateEmailOtpCode,
  hashEmailOtpCode,
  verifyEmailOtpCode,
  isOtpExpired,
} = require('../../utils/emailOtp');
const {
  generatePasswordResetToken,
  hashPasswordResetToken,
  verifyPasswordResetToken,
  getPasswordResetOtpExpiryDate,
  getPasswordResetTokenExpiryDate,
  isPasswordResetResendCooldownActive,
  passwordResetResendCooldownRemainingSeconds,
} = require('../../utils/passwordResetToken');
const { hashPassword } = require('../../utils/password');
const { sendPasswordResetOtpEmail } = require('../../shared/services/email.service');
const { recordAudit } = require('../../utils/auditRecorder');
const otpRepository = require('./passwordResetOtp.repository');
const { AUTH_ERROR_CODES, messageForCode, maskEmail } = require('../../utils/authErrorCatalog');
const { recordOtpFailure, recordOtpRateLimited } = require('./otpSecurityEvents');
const { revokeUserSessionsSafely } = require('./authSession.service');
const { SESSION_END_REASONS } = require('../../shared/audit/auditActions');
const { log } = require('../../utils/logger');
const { getRequestContext } = require('../../shared/requestContext');

const FORGOT_SUCCESS =
  'إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال رمز التحقق إليه.';
const RESEND_GENERIC_SUCCESS =
  'إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال رمز تحقق جديد.';
const GENERIC_OTP_ERROR = messageForCode(AUTH_ERROR_CODES.INVALID_OTP);
const MAX_ATTEMPTS_ERROR = messageForCode(AUTH_ERROR_CODES.OTP_RATE_LIMITED);
const OTP_VERIFIED_SUCCESS = 'تم التحقق من الرمز بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.';
const RESET_SUCCESS = 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.';
const INVALID_RESET_SESSION = 'جلسة إعادة التعيين غير صالحة أو منتهية الصلاحية.';

async function persistPasswordResetOtp(userId, email, codeHash, expiresAt, lastSentAt) {
  await prisma.$transaction(async (tx) => {
    await otpRepository.invalidateActiveOtpsForEmail(email, tx);
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
 * Persist reset OTP then attempt delivery. Email failures must not throw out of
 * forgot-password (anti-enumeration) and must not roll back the OTP row.
 *
 * @returns {Promise<{ email: string, deliveryFailed: boolean }>}
 */
async function issuePasswordResetOtp(user, options = {}) {
  const send = typeof options.send === 'function' ? options.send : sendPasswordResetOtpEmail;
  const persistOtp =
    typeof options.persistOtp === 'function' ? options.persistOtp : persistPasswordResetOtp;
  const email = String(user.email).trim().toLowerCase();
  const now = new Date();
  const otp = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(otp, email);
  const expiresAt = getPasswordResetOtpExpiryDate(now);

  await persistOtp(user.id, email, codeHash, expiresAt, now);

  try {
    await send({
      to: email,
      otp,
      name: user.full_name,
    });
    return { email, deliveryFailed: false };
  } catch (err) {
    log('error', 'Password reset OTP email delivery failed after persist', {
      to: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      category: err?.category || null,
      error: String(err?.message || 'unknown').slice(0, 200),
    });
    return { email, deliveryFailed: true };
  }
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const t0 = Date.now();
  const requestId = getRequestContext()?.requestId || null;
  const stage = (name, extra = {}) => {
    log('info', 'FORGOT_PASSWORD_STAGE', {
      stage: name,
      requestId,
      durationMs: Date.now() - t0,
      ...extra,
    });
  };

  try {
    stage('START');
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        full_name: true,
        status: true,
      },
    });
    stage('USER_LOOKUP_DONE', { found: Boolean(user) });

    if (user) {
      // Always return the generic success message — even if deliveryFailed.
      const issued = await issuePasswordResetOtp(user);
      stage('OTP_CREATED', { deliveryFailed: Boolean(issued.deliveryFailed) });
      await recordAudit({
        userId: user.id,
        actionType: 'PASSWORD_RESET_REQUESTED',
        entityType: 'user',
        entityId: user.id,
        newValues: { identifierMasked: maskEmail(normalizedEmail) },
      }).catch(() => null);
      stage(issued.deliveryFailed ? 'EMAIL_SEND_FAILURE' : 'EMAIL_SEND_SUCCESS');
    } else {
      stage('ACCOUNT_NOT_FOUND');
    }

    stage('RESPONSE_SENT', { status: 200 });
    return { message: FORGOT_SUCCESS };
  } catch (err) {
    // Never turn provider/DB surprises into 5xx that look like gateway failures to users.
    log('error', 'FORGOT_PASSWORD_UNEXPECTED', {
      requestId,
      durationMs: Date.now() - t0,
      name: err?.name || null,
      category: err?.category || null,
      error: String(err?.message || 'unknown').slice(0, 200),
    });
    return { message: FORGOT_SUCCESS };
  }
}

async function resendPasswordResetOtp(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      full_name: true,
    },
  });

  if (!user) {
    return { message: RESEND_GENERIC_SUCCESS };
  }

  const latest = await otpRepository.findLatestOtpForCooldown(normalizedEmail);
  if (latest && isPasswordResetResendCooldownActive(latest.last_sent_at)) {
    const seconds = passwordResetResendCooldownRemainingSeconds(latest.last_sent_at);
    throw new ApiError(
      429,
      messageForCode(AUTH_ERROR_CODES.OTP_RESEND_COOLDOWN),
      { cooldownSeconds: seconds },
      AUTH_ERROR_CODES.OTP_RESEND_COOLDOWN
    );
  }

  await issuePasswordResetOtp(user);
  return { message: RESEND_GENERIC_SUCCESS };
}

async function verifyPasswordResetOtp(email, otp) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  const record = await otpRepository.findLatestActiveOtp(normalizedEmail);
  if (!record) {
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  if (isOtpExpired(record.expires_at)) {
    throw new ApiError(400, messageForCode(AUTH_ERROR_CODES.OTP_EXPIRED), null, AUTH_ERROR_CODES.OTP_EXPIRED);
  }

  if (record.attempts_count >= env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    await recordOtpRateLimited({
      userId: user.id,
      otpId: record.id,
      purpose: 'PASSWORD_RESET',
      maxAttempts: env.PASSWORD_RESET_OTP_MAX_ATTEMPTS,
    });
    throw new ApiError(429, MAX_ATTEMPTS_ERROR, null, AUTH_ERROR_CODES.OTP_RATE_LIMITED);
  }

  const isValid = verifyEmailOtpCode(otp, normalizedEmail, record.code_hash);
  if (!isValid) {
    await otpRepository.incrementOtpAttempts(record.id);
    await recordOtpFailure({
      userId: user.id,
      otpId: record.id,
      purpose: 'PASSWORD_RESET',
      attemptsUsed: (record.attempts_count || 0) + 1,
      maxAttempts: env.PASSWORD_RESET_OTP_MAX_ATTEMPTS,
    });
    throw new ApiError(400, GENERIC_OTP_ERROR, null, AUTH_ERROR_CODES.INVALID_OTP);
  }

  const resetToken = generatePasswordResetToken();
  const resetTokenHash = hashPasswordResetToken(resetToken, normalizedEmail);
  const resetTokenExpiresAt = getPasswordResetTokenExpiryDate();

  await otpRepository.storeResetToken(record.id, {
    resetTokenHash,
    resetTokenExpiresAt,
  });

  await recordAudit({
    userId: user.id,
    actionType: 'PASSWORD_RESET_OTP_VERIFIED',
    entityType: 'user',
    entityId: user.id,
    newValues: { identifierMasked: maskEmail(normalizedEmail) },
  });

  return {
    message: OTP_VERIFIED_SUCCESS,
    resetToken,
  };
}

async function resetPasswordWithToken({ email, resetToken, newPassword }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const resetTokenHash = hashPasswordResetToken(resetToken, normalizedEmail);
  const record = await otpRepository.findValidResetSession(normalizedEmail, resetTokenHash);

  if (!record || !verifyPasswordResetToken(resetToken, normalizedEmail, record.reset_token_hash)) {
    throw new ApiError(400, INVALID_RESET_SESSION);
  }

  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, status: true, email_verified_at: true },
  });

  if (!user) {
    throw new ApiError(400, INVALID_RESET_SESSION);
  }

  const password_hash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: user.id },
      data: {
        password_hash,
        updated_at: new Date(),
      },
    });
    await otpRepository.markResetCompleted(record.id, tx);
  });

  await recordAudit({
    userId: user.id,
    actionType: 'PASSWORD_RESET_COMPLETED',
    entityType: 'user',
    entityId: user.id,
    newValues: { identifierMasked: maskEmail(normalizedEmail) },
  });

  await revokeUserSessionsSafely(user.id, SESSION_END_REASONS.PASSWORD_RESET, { actorUserId: user.id });

  return { message: RESET_SUCCESS };
}

module.exports = {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
  issuePasswordResetOtp,
  FORGOT_SUCCESS,
  RESEND_GENERIC_SUCCESS,
  GENERIC_OTP_ERROR,
  MAX_ATTEMPTS_ERROR,
  OTP_VERIFIED_SUCCESS,
  RESET_SUCCESS,
};
