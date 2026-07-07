const { Resend } = require('resend');
const { env } = require('../../config/env');
const { log } = require('../../utils/logger');
const {
  buildEmailVerificationOtpHtml,
  buildEmailVerificationOtpText,
} = require('../templates/emailVerificationOtp.template.js');
const {
  buildPasswordResetOtpHtml,
  buildPasswordResetOtpText,
} = require('../templates/passwordResetOtp.template.js');

const SUBJECT = 'رمز توثيق البريد الإلكتروني - BATTECHNO LMS';
const PASSWORD_RESET_SUBJECT = 'رمز إعادة تعيين كلمة المرور - BATTECHNO LMS';

let resendClient = null;

function getResendClient() {
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * @param {{ to: string, otp: string, userName?: string }} params
 */
async function sendEmailVerificationOtp({ to, otp, userName }) {
  const client = getResendClient();
  if (!client) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not configured');
    }
    log('warn', 'Email OTP skipped: RESEND_API_KEY not configured', { to: String(to).replace(/(.{2}).+(@.+)/, '$1***$2') });
    return { skipped: true };
  }

  const expiryMinutes = env.EMAIL_OTP_EXPIRY_MINUTES;
  const html = buildEmailVerificationOtpHtml({ userName, otp, expiryMinutes });
  const text = buildEmailVerificationOtpText({ userName, otp, expiryMinutes });

  const result = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject: SUBJECT,
    html,
    text,
  });

  if (result.error) {
    log('error', 'Resend email delivery failed', {
      to: String(to).replace(/(.{2}).+(@.+)/, '$1***$2'),
      error: result.error.message || 'unknown',
    });
    throw new Error('Failed to send verification email');
  }

  return { id: result.data?.id ?? null };
}

/**
 * @param {{ to: string, otp: string, name?: string }} params
 */
async function sendPasswordResetOtpEmail({ to, otp, name }) {
  const client = getResendClient();
  if (!client) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not configured');
    }
    log('warn', 'Password reset OTP email skipped: RESEND_API_KEY not configured', {
      to: String(to).replace(/(.{2}).+(@.+)/, '$1***$2'),
    });
    return { skipped: true };
  }

  const expiryMinutes = env.PASSWORD_RESET_OTP_EXPIRY_MINUTES;
  const html = buildPasswordResetOtpHtml({ userName: name, otp, expiryMinutes });
  const text = buildPasswordResetOtpText({ userName: name, otp, expiryMinutes });

  const result = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [to],
    subject: PASSWORD_RESET_SUBJECT,
    html,
    text,
  });

  if (result.error) {
    log('error', 'Resend password reset email delivery failed', {
      to: String(to).replace(/(.{2}).+(@.+)/, '$1***$2'),
      error: result.error.message || 'unknown',
    });
    throw new Error('Failed to send password reset email');
  }

  return { id: result.data?.id ?? null };
}

module.exports = { sendEmailVerificationOtp, sendPasswordResetOtpEmail };
