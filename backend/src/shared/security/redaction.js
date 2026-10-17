'use strict';

/**
 * Shared redaction for operational logs and security-event metadata.
 * Only affects what we write to logs / audit rows, never request routing.
 */

const REDACTED = '[REDACTED]';

/** Query parameter names whose values must never reach logs. */
const SENSITIVE_QUERY_PARAMS = new Set([
  'access_token',
  'token',
  'id_token',
  'refresh_token',
  'reset_token',
  'resettoken',
  'authorization',
  'auth',
  'password',
  'new_password',
  'otp',
  'code',
  'email',
  'sid',
  'signature',
  'x-amz-signature',
  'x-amz-credential',
  'secret',
  'api_key',
  'apikey',
  'key',
]);

/** Object keys whose values are dropped from logs / security metadata. */
const SENSITIVE_KEY_RE =
  /pass(word|wd)?|token|secret|authorization|cookie|otp|code[_-]?hash|api[_-]?key|signature|credential|session[_-]?cookie/i;

const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** Remove JWTs and Bearer credentials embedded anywhere in a string. */
function redactString(value) {
  if (typeof value !== 'string') return value;
  return value.replace(BEARER_RE, `Bearer ${REDACTED}`).replace(JWT_RE, REDACTED);
}

/**
 * Redact sensitive query-string values in a request URL (path is preserved).
 * `/uploads/a.pdf?access_token=eyJ..&v=2` → `/uploads/a.pdf?access_token=[REDACTED]&v=2`
 */
function redactUrl(url) {
  if (typeof url !== 'string' || !url) return url;
  const q = url.indexOf('?');
  if (q === -1) return redactString(url);
  const path = url.slice(0, q);
  const hashIndex = url.indexOf('#', q);
  const query = url.slice(q + 1, hashIndex === -1 ? undefined : hashIndex);
  const parts = query.split('&').map((pair) => {
    if (!pair) return pair;
    const eq = pair.indexOf('=');
    const rawName = eq === -1 ? pair : pair.slice(0, eq);
    let name = rawName;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, ' '));
    } catch {
      /* keep raw */
    }
    if (eq !== -1 && SENSITIVE_QUERY_PARAMS.has(name.trim().toLowerCase())) return `${rawName}=${REDACTED}`;
    return pair;
  });
  return redactString(`${path}?${parts.join('&')}`);
}

/**
 * Deep-copy a log / metadata object with secrets removed and sizes bounded.
 * @param {unknown} value
 * @param {{ maxString?: number, maxKeys?: number, maxArray?: number, maxDepth?: number }} [limits]
 */
function sanitizeForLog(value, limits = {}, depth = 0) {
  const { maxString = 2000, maxKeys = 50, maxArray = 50, maxDepth = 5 } = limits;
  if (value == null) return value;
  if (typeof value === 'string') {
    const s = redactString(value);
    return s.length > maxString ? `${s.slice(0, maxString)}…` : s;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= maxDepth) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.slice(0, maxArray).map((v) => sanitizeForLog(v, limits, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    let n = 0;
    for (const [key, v] of Object.entries(value)) {
      if (n >= maxKeys) break;
      n += 1;
      out[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : sanitizeForLog(v, limits, depth + 1);
    }
    return out;
  }
  return undefined;
}

/** Bound an attacker-controlled scalar (user agent, route, identifier, reason). */
function boundString(value, max) {
  if (value == null) return null;
  const s = redactString(String(value)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

module.exports = {
  REDACTED,
  SENSITIVE_QUERY_PARAMS,
  SENSITIVE_KEY_RE,
  redactString,
  redactUrl,
  sanitizeForLog,
  boundString,
};
