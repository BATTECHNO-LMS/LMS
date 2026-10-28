'use strict';

const { env } = require('../../config/env');
const { formatEmailFrom } = require('../../config/brand');
const { log } = require('../../utils/logger');
const {
  buildEmailVerificationOtpHtml,
  buildEmailVerificationOtpText,
} = require('../templates/emailVerificationOtp.template.js');
const {
  buildPasswordResetOtpHtml,
  buildPasswordResetOtpText,
} = require('../templates/passwordResetOtp.template.js');

const SUBJECT = 'رمز توثيق البريد الإلكتروني - eprojecto';
const PASSWORD_RESET_SUBJECT = 'رمز إعادة تعيين كلمة المرور - eprojecto';

/** Outbound Resend HTTP timeout — must not hang registration/password-reset indefinitely. */
const RESEND_TIMEOUT_MS = Math.max(
  3000,
  Math.min(20000, Number(process.env.RESEND_HTTP_TIMEOUT_MS) || 10000)
);

function maskRecipient(to) {
  return String(to || '').replace(/(.{2}).+(@.+)/, '$1***$2');
}

/**
 * Classify Resend/API failures without exposing secrets.
 * @param {number} status
 * @param {string} message
 */
function classifyProviderError(status, message) {
  const msg = String(message || '').toLowerCase();
  if (status === 401 || status === 403) return 'provider_auth_or_permission';
  if (status === 422 && /domain|not verified|from/i.test(msg)) return 'sender_domain_unverified';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_server_error';
  if (/timeout|aborted|network|fetch failed|econnreset|etimedout/i.test(msg)) {
    return 'provider_timeout_or_network';
  }
  if (/domain|not verified/i.test(msg)) return 'sender_domain_unverified';
  return 'provider_rejected';
}

/**
 * @param {{
 *   to: string,
 *   subject: string,
 *   html: string,
 *   text: string,
 *   purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
 * }} params
 * @returns {Promise<{ id: string|null, skipped?: boolean }>}
 */
async function sendViaResend({ to, subject, html, text, purpose }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    if (env.NODE_ENV === 'production') {
      const err = new Error('RESEND_API_KEY is not configured');
      err.category = 'missing_api_key';
      throw err;
    }
    log('warn', 'Email OTP skipped: RESEND_API_KEY not configured', {
      purpose,
      to: maskRecipient(to),
    });
    return { skipped: true, id: null };
  }

  const from = formatEmailFrom(env.RESEND_FROM_EMAIL);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const raw = await res.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const providerMessage = parsed?.message || parsed?.name || raw.slice(0, 180) || `HTTP ${res.status}`;
      const category = classifyProviderError(res.status, providerMessage);
      log('error', 'Resend email delivery failed', {
        purpose,
        to: maskRecipient(to),
        httpStatus: res.status,
        category,
        durationMs,
        error: String(providerMessage).slice(0, 200),
      });
      const err = new Error(
        purpose === 'PASSWORD_RESET'
          ? 'Failed to send password reset email'
          : 'Failed to send verification email'
      );
      err.category = category;
      err.httpStatus = res.status;
      throw err;
    }

    const id = parsed?.id ? String(parsed.id) : null;
    log('info', 'Resend email accepted', {
      purpose,
      to: maskRecipient(to),
      durationMs,
      hasMessageId: Boolean(id),
    });
    return { id };
  } catch (err) {
    if (err?.category) throw err;
    const aborted = err?.name === 'AbortError';
    const category = aborted ? 'provider_timeout_or_network' : classifyProviderError(0, err?.message);
    log('error', 'Resend email delivery failed', {
      purpose,
      to: maskRecipient(to),
      category,
      durationMs: Date.now() - t0,
      error: String(err?.message || 'unknown').slice(0, 200),
    });
    const wrapped = new Error(
      purpose === 'PASSWORD_RESET'
        ? 'Failed to send password reset email'
        : 'Failed to send verification email'
    );
    wrapped.category = category;
    wrapped.cause = err;
    throw wrapped;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ to: string, otp: string, userName?: string }} params
 */
async function sendEmailVerificationOtp({ to, otp, userName }) {
  const expiryMinutes = env.EMAIL_OTP_EXPIRY_MINUTES;
  const html = buildEmailVerificationOtpHtml({ userName, otp, expiryMinutes });
  const text = buildEmailVerificationOtpText({ userName, otp, expiryMinutes });
  return sendViaResend({
    to,
    subject: SUBJECT,
    html,
    text,
    purpose: 'EMAIL_VERIFICATION',
  });
}

/**
 * @param {{ to: string, otp: string, name?: string }} params
 */
async function sendPasswordResetOtpEmail({ to, otp, name }) {
  const expiryMinutes = env.PASSWORD_RESET_OTP_EXPIRY_MINUTES;
  const html = buildPasswordResetOtpHtml({ userName: name, otp, expiryMinutes });
  const text = buildPasswordResetOtpText({ userName: name, otp, expiryMinutes });
  return sendViaResend({
    to,
    subject: PASSWORD_RESET_SUBJECT,
    html,
    text,
    purpose: 'PASSWORD_RESET',
  });
}

/**
 * Safe diagnostic used by internal scripts — never logs secrets or OTP.
 * @returns {Promise<{
 *   providerConfigured: boolean,
 *   senderConfigured: boolean,
 *   sender: string,
 *   providerCallSuccess: boolean,
 *   providerMessageId: string|null,
 *   errorCategory: string|null,
 * }>}
 */
async function probeEmailDelivery({ to = 'delivered@resend.dev' } = {}) {
  const providerConfigured = Boolean(env.RESEND_API_KEY);
  const senderConfigured = Boolean(env.RESEND_FROM_EMAIL);
  const sender = formatEmailFrom(env.RESEND_FROM_EMAIL);
  if (!providerConfigured) {
    return {
      providerConfigured: false,
      senderConfigured,
      sender,
      providerCallSuccess: false,
      providerMessageId: null,
      errorCategory: 'missing_api_key',
    };
  }
  try {
    const result = await sendViaResend({
      to,
      subject: 'eprojecto delivery probe',
      html: '<p>probe</p>',
      text: 'probe',
      purpose: 'EMAIL_VERIFICATION',
    });
    return {
      providerConfigured: true,
      senderConfigured,
      sender,
      providerCallSuccess: true,
      providerMessageId: result.id || null,
      errorCategory: null,
    };
  } catch (err) {
    return {
      providerConfigured: true,
      senderConfigured,
      sender,
      providerCallSuccess: false,
      providerMessageId: null,
      errorCategory: err?.category || 'provider_rejected',
    };
  }
}

module.exports = {
  sendEmailVerificationOtp,
  sendPasswordResetOtpEmail,
  probeEmailDelivery,
  classifyProviderError,
  RESEND_TIMEOUT_MS,
};
