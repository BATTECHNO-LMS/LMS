'use strict';

/**
 * MFA key material handling (Node `crypto` only — no custom primitives):
 *   - TOTP secrets: AES-256-GCM, random 96-bit IV, AAD bound to the owning user, so a
 *     ciphertext copied to another user's row does not decrypt.
 *   - Recovery codes: HMAC-SHA256 with a key derived from the same master key (codes are
 *     60-bit random values, so a keyed fast hash is sufficient and allows indexed lookup).
 *   - Challenge tokens: 256-bit random, stored as SHA-256 only.
 * Subkeys are derived from MFA_ENCRYPTION_KEY with HKDF; the master key never leaves memory.
 * Every function fails closed: a missing/malformed key throws, nothing falls back to plaintext.
 */

const crypto = require('crypto');
const { env } = require('../../config/env');

const KEY_BYTES = 32;
const IV_BYTES = 12;
const FORMAT_VERSION = 'v1';
const HKDF_SALT = Buffer.from('eprojecto-mfa-v1');

/** Unambiguous uppercase alphabet (no I, O, 0, 1): 32 symbols → 5 bits per character. */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 12;

class MfaConfigurationError extends Error {
  constructor(reason) {
    super(`MFA configuration invalid: ${reason}`);
    this.name = 'MfaConfigurationError';
    this.code = 'MFA_UNAVAILABLE';
  }
}

/**
 * @param {string} raw base64 / base64url (32 bytes) or 64 hex characters
 * @returns {Buffer|null}
 */
function parseMasterKey(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  let buf = null;
  if (/^[0-9a-f]{64}$/i.test(value)) {
    buf = Buffer.from(value, 'hex');
  } else if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    buf = Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }
  if (!buf || buf.length !== KEY_BYTES) return null;
  // Reject trivially weak keys (all bytes identical, e.g. zero-filled placeholders).
  if (buf.every((b) => b === buf[0])) return null;
  return buf;
}

/**
 * Startup / health check. Never includes the key (or any part of it) in the reason.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateMfaConfiguration(config = env) {
  if (!config.MFA_ENABLED) return { ok: true };
  if (!config.MFA_ENCRYPTION_KEY) {
    return { ok: false, reason: 'MFA_ENCRYPTION_KEY is required when MFA is enabled' };
  }
  if (!parseMasterKey(config.MFA_ENCRYPTION_KEY)) {
    return { ok: false, reason: 'MFA_ENCRYPTION_KEY must be 32 random bytes (base64 or 64 hex characters)' };
  }
  return { ok: true };
}

let cachedFor = null;
let cachedKeys = null;

function derivedKeys() {
  const raw = env.MFA_ENCRYPTION_KEY;
  if (cachedKeys && cachedFor === raw) return cachedKeys;
  const master = parseMasterKey(raw);
  if (!master) throw new MfaConfigurationError('missing or malformed encryption key');
  const derive = (info) => Buffer.from(crypto.hkdfSync('sha256', master, HKDF_SALT, Buffer.from(info), KEY_BYTES));
  cachedKeys = Object.freeze({
    enc: derive('totp-secret-encryption'),
    recovery: derive('recovery-code-hmac'),
  });
  cachedFor = raw;
  return cachedKeys;
}

function b64u(buf) {
  return Buffer.from(buf).toString('base64url');
}

function aadFor(userId) {
  return Buffer.from(`user_mfa_methods:${String(userId || '')}`);
}

/**
 * @param {string} plaintext Base32 TOTP secret
 * @param {string} userId owner (bound as AAD)
 */
function encryptSecret(plaintext, userId) {
  if (typeof plaintext !== 'string' || !plaintext) throw new TypeError('secret required');
  if (!userId) throw new TypeError('userId required');
  const { enc } = derivedKeys();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', enc, iv);
  cipher.setAAD(aadFor(userId));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, b64u(iv), b64u(tag), b64u(ct)].join('.');
}

/** Throws on any tampering, wrong owner, or wrong key (GCM authentication). */
function decryptSecret(blob, userId) {
  const parts = typeof blob === 'string' ? blob.split('.') : [];
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) throw new Error('Unsupported MFA secret format');
  const { enc } = derivedKeys();
  const [, ivB, tagB, ctB] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', enc, Buffer.from(ivB, 'base64url'));
  decipher.setAAD(aadFor(userId));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64url')), decipher.final()]).toString('utf8');
}

function generateRecoveryCode() {
  let out = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) out += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

/** @returns {string[]} distinct display-formatted codes (XXXX-XXXX-XXXX) */
function generateRecoveryCodes(count) {
  const set = new Set();
  while (set.size < count) set.add(generateRecoveryCode());
  return [...set];
}

/** Uppercase, strip separators/whitespace; null when it cannot be a recovery code. */
function normalizeRecoveryCode(input) {
  if (typeof input !== 'string') return null;
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== RECOVERY_CODE_LENGTH) return null;
  for (const ch of s) if (!RECOVERY_ALPHABET.includes(ch)) return null;
  return s;
}

function hashRecoveryCode(normalized) {
  const { recovery } = derivedKeys();
  return crypto.createHmac('sha256', recovery).update(String(normalized)).digest('hex');
}

function generateChallengeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashChallengeToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function resetMfaKeyCacheForTests() {
  cachedFor = null;
  cachedKeys = null;
}

module.exports = {
  MfaConfigurationError,
  RECOVERY_ALPHABET,
  RECOVERY_CODE_LENGTH,
  parseMasterKey,
  validateMfaConfiguration,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  hashRecoveryCode,
  generateChallengeToken,
  hashChallengeToken,
  resetMfaKeyCacheForTests,
};
