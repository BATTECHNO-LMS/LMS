import { ROLES } from '../constants/roles.js';

const PORTAL_CONFIG = {
  admin: { role: ROLES.SUPER_ADMIN, loginPath: '/login/admin' },
  instructor: { role: ROLES.INSTRUCTOR, loginPath: '/login/instructor' },
  student: { role: ROLES.STUDENT, loginPath: '/login/student' },
  reviewer: { role: ROLES.REVIEWER, loginPath: '/login/reviewer' },
  institutions: { role: ROLES.STUDENT, loginPath: '/institutions/login' },
  universities: { role: ROLES.STUDENT, loginPath: '/universities/login' },
};

export function detectPortalKeyFromHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return null;
  const first = host.split('.')[0];
  return PORTAL_CONFIG[first] ? first : null;
}

export function getPortalConfig(portalKey) {
  return PORTAL_CONFIG[portalKey] ?? null;
}

export function getCurrentPortalKey() {
  if (typeof window === 'undefined') return null;
  return detectPortalKeyFromHostname(window.location.hostname);
}

export function getLoginPathForCurrentPortal() {
  const portal = getPortalConfig(getCurrentPortalKey());
  return portal?.loginPath ?? '/portals';
}

/** Convenience last-portal hint (non-authoritative UI only). */
export function rememberSelectedPortal(portalType) {
  if (typeof window === 'undefined' || !portalType) return;
  try {
    window.sessionStorage.setItem('battechno_lms_last_portal', String(portalType));
  } catch {
    /* ignore */
  }
}

export function getRememberedPortal() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem('battechno_lms_last_portal');
    if (value === 'INSTITUTION' || value === 'UNIVERSITY') return value;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Read the `portalType` claim of a JWT without verifying it. Only for choosing which
 * login page to show after the session ends — never for authorization.
 */
export function portalTypeFromToken(token) {
  if (typeof token !== 'string') return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const value = JSON.parse(json)?.portalType;
    return value === 'UNIVERSITY' || value === 'INSTITUTION' ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null} [portalType] the signed-in user's portal (preferred over the per-tab hint,
 *   which is missing in tabs that never visited a login page)
 */
export function getRememberedPortalLoginPath(portalType = null) {
  const value = portalType === 'INSTITUTION' || portalType === 'UNIVERSITY' ? portalType : getRememberedPortal();
  if (value === 'INSTITUTION') return '/institutions/login';
  if (value === 'UNIVERSITY') return '/universities/login';
  return getLoginPathForCurrentPortal();
}
