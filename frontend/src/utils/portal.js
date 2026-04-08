import { ROLES } from '../constants/roles.js';

const PORTAL_CONFIG = {
  admin: { role: ROLES.SUPER_ADMIN, loginPath: '/login/admin' },
  instructor: { role: ROLES.INSTRUCTOR, loginPath: '/login/instructor' },
  student: { role: ROLES.STUDENT, loginPath: '/login/student' },
  reviewer: { role: ROLES.UNIVERSITY_REVIEWER, loginPath: '/login/reviewer' },
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
  return portal?.loginPath ?? '/login';
}
