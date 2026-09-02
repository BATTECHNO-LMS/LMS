import { storageKeys, getStorageItem } from './storage.js';

/**
 * Append the current JWT to a same-origin /uploads URL so browser navigation
 * (window.open / <a target=_blank>) can pass authenticate middleware.
 */
export function withUploadAccessToken(url) {
  if (!url || typeof url !== 'string') return url;
  const token = getStorageItem(storageKeys.authToken);
  if (!token || typeof token !== 'string') return url;

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(url, base);
    const isUploadsPath = parsed.pathname.startsWith('/uploads/');
    const isLocalHost =
      typeof window === 'undefined' ||
      parsed.origin === window.location.origin ||
      url.startsWith('/uploads/');
    if (!isUploadsPath || !isLocalHost) return url;
    parsed.searchParams.set('access_token', token);
    if (url.startsWith('/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function openProtectedUploadUrl(url) {
  const protectedUrl = withUploadAccessToken(url);
  if (!protectedUrl) return null;
  return window.open(protectedUrl, '_blank', 'noopener,noreferrer');
}
