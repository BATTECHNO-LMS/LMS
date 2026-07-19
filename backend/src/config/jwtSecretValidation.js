'use strict';

/**
 * Pure JWT secret validation (no I/O, no database).
 * Used by production startup and unit tests.
 */

const PLACEHOLDER_PATTERNS = [
  /^\s*$/,
  /^changeme$/i,
  /^change.?me$/i,
  /^your[-_]?local/i,
  /^your[-_]?jwt/i,
  /^your[-_]?secret/i,
  /^replace[-_]?me/i,
  /^todo$/i,
  /^secret$/i,
  /^jwt[_-]?secret$/i,
  /^battechno-dev-only/i,
  /^test$/i,
  /^password$/i,
];

/**
 * @param {string | undefined | null} secret
 * @param {{ minLength?: number }} [opts]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateJwtSecret(secret, opts = {}) {
  const minLength = Number(opts.minLength) > 0 ? Number(opts.minLength) : 32;
  if (secret == null || typeof secret !== 'string') {
    return { ok: false, reason: 'JWT_SECRET is missing' };
  }
  const value = secret;
  if (!value.trim()) {
    return { ok: false, reason: 'JWT_SECRET is empty' };
  }
  if (value.length < minLength) {
    return { ok: false, reason: `JWT_SECRET must be at least ${minLength} characters` };
  }
  for (const re of PLACEHOLDER_PATTERNS) {
    if (re.test(value.trim())) {
      return { ok: false, reason: 'JWT_SECRET looks like a placeholder' };
    }
  }
  return { ok: true };
}

/**
 * Throws if invalid — for production startup.
 * @param {string | undefined | null} secret
 * @param {{ minLength?: number }} [opts]
 */
function assertJwtSecret(secret, opts = {}) {
  const result = validateJwtSecret(secret, opts);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}

module.exports = {
  validateJwtSecret,
  assertJwtSecret,
  PLACEHOLDER_PATTERNS,
};
