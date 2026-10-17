'use strict';

/**
 * Canonical relative in-app path policy (open-redirect safe).
 * Rejects protocol-relative (//), backslashes, schemes, and control chars.
 *
 * @param {unknown} value
 * @param {{ maxLength?: number }} [opts]
 * @returns {string | null}
 */
function sanitizeAppRelativePath(value, opts = {}) {
  if (value == null) return null;
  const maxLength = opts.maxLength ?? 512;
  const raw = String(value).trim();
  if (!raw || raw.length > maxLength) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  // "/http:..." or "/javascript:..." style
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  return raw;
}

/**
 * CTA / link URL for CMS & notifications.
 * Allows https?, mailto:, or a safe relative app path. Rejects javascript:/data:/vbscript:
 * and protocol-relative URLs.
 *
 * @param {unknown} url
 * @returns {string | null}
 */
function sanitizeCtaOrAppUrl(url) {
  if (url == null) return null;
  const raw = String(url).trim();
  if (!raw || raw.length > 2000) return null;

  const lower = raw.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  if (/^https:\/\//i.test(raw)) return raw;
  // http allowed only for explicit absolute URLs (CMS may need it); still not protocol-relative
  if (/^http:\/\//i.test(raw)) return raw;
  if (/^mailto:/i.test(raw)) return raw;

  return sanitizeAppRelativePath(raw, { maxLength: 2000 });
}

module.exports = {
  sanitizeAppRelativePath,
  sanitizeCtaOrAppUrl,
};
