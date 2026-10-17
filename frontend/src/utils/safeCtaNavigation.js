import { sanitizeReturnTo } from '../features/auth/session/sessionPolicy.js';

/**
 * Navigate or open a CMS/notification CTA without open-redirect.
 * @param {string | null | undefined} url
 * @param {{ navigate?: (to: string) => void }} [opts]
 * @returns {boolean} whether navigation occurred
 */
export function openSafeCtaUrl(url, opts = {}) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const raw = url.trim();
  if (/^https:\/\//i.test(raw) || /^http:\/\//i.test(raw)) {
    window.open(raw, '_blank', 'noopener,noreferrer');
    return true;
  }
  const safe = sanitizeReturnTo(raw);
  if (!safe) return false;
  if (typeof opts.navigate === 'function') {
    opts.navigate(safe);
    return true;
  }
  return false;
}
