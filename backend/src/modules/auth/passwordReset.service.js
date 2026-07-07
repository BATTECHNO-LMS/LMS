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

const FORGOT_SUCCESS =
  'إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال رمز التحقق إليه.';
const RESEND_GENERIC_SUCCESS =
  'إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال رمز تحقق جديد.';
const GENERIC_OTP_ERROR = 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
const MAX_ATTEMPTS_ERROR = 'تم تجاوز عدد المحاولات المسموح. يرجى طلب رمز جديد.';
const OTP_VERIFIED_SUCCESS = 'تم التحقق من الرمز بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.';
const RESET_SUCCESS = 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.';
const INVALID_RESET_SESSION = 'جلسة إعادة التعيين غير صالحة أو منتهية الصلاحية.';

async function issuePasswordResetOtp(user) {
  const email = String(user.email).trim().toLowerCase();
  const now = new Date();
  const otp = generateEmailOtpCode();
  const codeHash = hashEmailOtpCode(otp, email);
  const expiresAt = getPasswordResetOtpExpiryDate(now);

  await prisma.$transaction(async (tx) => {
    await otpRepository.invalidateActiveOtpsForEmail(email, tx);
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

  await sendPasswordResetOtpEmail({
    to: email,
    otp,
    name: user.full_name,
  });
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await prisma.users.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      full_name: true,
      status: true,
    },
  });

  if (user) {
    await issuePasswordResetOtp(user);
    await recordAudit({
      userId: user.id,
      actionType: 'PASSWORD_RESET_REQUESTED',
      entityType: 'user',
      entityId: user.id,
      newValues: { email: normalizedEmail },
    });
  }

  return { message: FORGOT_SUCCESS };
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
      `يمكنك إعادة الإرسال بعد ${seconds} ثانية`,
      { cooldownSeconds: seconds },
      'OTP_RESEND_COOLDOWN'
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
    throw new ApiError(400, GENERIC_OTP_ERROR);
  }

  const record = await otpRepository.findLatestActiveOtp(normalizedEmail);
  if (!record) {
    throw new ApiError(400, GENERIC_OTP_ERROR);
  }

  if (isOtpExpired(record.expires_at)) {
    throw new ApiError(400, GENERIC_OTP_ERROR);
  }

  if (record.attempts_count >= env.PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    throw new ApiError(400, MAX_ATTEMPTS_ERROR);
  }

  const isValid = verifyEmailOtpCode(otp, normalizedEmail, record.code_hash);
  if (!isValid) {
    await otpRepository.incrementOtpAttempts(record.id);
    throw new ApiError(400, GENERIC_OTP_ERROR);
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
    newValues: { email: normalizedEmail },
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
    newValues: { email: normalizedEmail },
  });

  return { message: RESET_SUCCESS };
}

module.exports = {
  requestPasswordReset,
  resendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
  FORGOT_SUCCESS,
  RESEND_GENERIC_SUCCESS,
  GENERIC_OTP_ERROR,
  MAX_ATTEMPTS_ERROR,
  OTP_VERIFIED_SUCCESS,
  RESET_SUCCESS,
};
