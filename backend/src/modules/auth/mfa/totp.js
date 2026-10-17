'use strict';

/**
 * RFC 6238 TOTP via otplib (maintained, standards-compliant). Parameters are the
 * authenticator-app defaults (SHA-1, 6 digits, 30 s) for Google / Microsoft Authenticator,
 * 1Password and Authy-compatible clients.
 *
 * Clock skew: ±1 time step (±30 s). Replay protection: otplib returns the matched time step;
 * callers persist it and pass `afterTimeStep`, so the same (or an older) code is rejected
 * for the rest of its validity window — across challenges, step-ups and devices.
 */

const otplib = require('otplib');
const QRCode = require('qrcode');
const { env } = require('../../../config/env');

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
/** Tolerance in seconds on either side of "now" = one time step. */
const TOTP_EPOCH_TOLERANCE_SECONDS = TOTP_PERIOD_SECONDS;

function generateTotpSecret() {
  return otplib.generateSecret({ length: 20 });
}

/** Digits only after removing whitespace / dashes (pasted "123 456" is accepted). */
function normalizeTotpCode(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const s = String(input).replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(s) ? s : null;
}

/**
 * @param {{ secret: string, code: string, afterTimeStep?: number|null, now?: Date }} args
 * @returns {Promise<{ valid: boolean, timeStep?: number }>}
 */
async function verifyTotp({ secret, code, afterTimeStep = null, now = new Date() }) {
  const token = normalizeTotpCode(code);
  if (!token || !secret) return { valid: false };
  const result = await otplib.verify({
    secret,
    token,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    epoch: Math.floor(new Date(now).getTime() / 1000),
    epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    ...(Number.isSafeInteger(afterTimeStep) ? { afterTimeStep } : {}),
  });
  if (!result?.valid) return { valid: false };
  return { valid: true, timeStep: result.timeStep };
}

/** Test/fixture helper only (local smoke + unit tests). */
async function generateTotpCode(secret, now = new Date()) {
  return otplib.generate({
    secret,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    epoch: Math.floor(new Date(now).getTime() / 1000),
  });
}

/**
 * Standard otpauth:// URI. Label = issuer + masked e-mail (understandable, minimal PII).
 */
function buildOtpauthUri({ secret, accountLabel }) {
  return otplib.generateURI({
    issuer: env.MFA_ISSUER,
    label: accountLabel,
    secret,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
  });
}

/** QR rendered in memory as a data URL — never written to disk. */
async function qrDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
}

/** "ABCD EFGH ..." for manual entry. */
function formatSecretForDisplay(secret) {
  return String(secret || '').replace(/(.{4})(?=.)/g, '$1 ');
}

module.exports = {
  TOTP_PERIOD_SECONDS,
  TOTP_DIGITS,
  TOTP_ALGORITHM,
  TOTP_EPOCH_TOLERANCE_SECONDS,
  generateTotpSecret,
  normalizeTotpCode,
  verifyTotp,
  generateTotpCode,
  buildOtpauthUri,
  qrDataUrl,
  formatSecretForDisplay,
};
