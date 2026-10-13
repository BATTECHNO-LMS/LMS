/**
 * Pure session-timeout policy (no React / browser globals) so it can be unit-tested.
 *
 * Only explicit human interaction counts as activity. Background traffic (polling,
 * SSE, presence, notifications, analytics, recorded-lecture heartbeats) never extends
 * the session; the backend enforces the same rule independently.
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_BEFORE_MS = 5 * 60 * 1000;
export const ACTIVITY_PING_THROTTLE_MS = 60 * 1000;
export const PRESENCE_INTERVAL_MS = 60 * 1000;
export const IDLE_CHECK_INTERVAL_MS = 5 * 1000;
export const ACTIVITY_STORAGE_THROTTLE_MS = 5 * 1000;

/** DOM events that count as human activity. Payloads (keys, coordinates, text) are never read. */
export const ACTIVITY_EVENTS = Object.freeze(['pointerdown', 'keydown', 'touchstart', 'scroll', 'focus']);

export const AUTH_CHANNEL_NAME = 'eprojecto-auth';
export const LAST_ACTIVITY_STORAGE_KEY = 'battechno_lms_last_activity_at';
export const LAST_ACTIVITY_PING_STORAGE_KEY = 'battechno_lms_last_activity_ping_at';
export const LOGOUT_REASON_STORAGE_KEY = 'battechno_lms_logout_reason';
export const RETURN_TO_STORAGE_KEY = 'battechno_lms_return_to';

export const SESSION_END_CODES = Object.freeze([
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'SESSION_NOT_FOUND',
  'SESSION_ENDED',
  'SESSION_IDLE_TIMEOUT',
  'SESSION_ABSOLUTE_EXPIRED',
  'PORTAL_REQUIRED',
]);

export const IDLE_TIMEOUT_MESSAGE_AR = 'انتهت جلستك بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى.';
export const IDLE_WARNING_MESSAGE_AR = 'ستنتهي جلستك خلال 5 دقائق بسبب عدم النشاط.';

const LOGIN_REASON_MESSAGES_AR = Object.freeze({
  SESSION_IDLE_TIMEOUT: IDLE_TIMEOUT_MESSAGE_AR,
  SESSION_ABSOLUTE_EXPIRED: 'انتهت مدة جلستك. يرجى تسجيل الدخول مرة أخرى.',
  SESSION_ENDED: 'تم إنهاء جلستك. يرجى تسجيل الدخول مرة أخرى.',
  SESSION_NOT_FOUND: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  TOKEN_EXPIRED: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  TOKEN_INVALID: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  UNAUTHORIZED: 'يرجى تسجيل الدخول للمتابعة.',
  USER_LOGOUT: 'تم إنهاء الجلسة بنجاح.',
});

/**
 * @returns {'active'|'warning'|'expired'}
 */
export function computeIdleState({
  now,
  lastActivityAt,
  idleTimeoutMs = IDLE_TIMEOUT_MS,
  warningBeforeMs = IDLE_WARNING_BEFORE_MS,
}) {
  const last = Number(lastActivityAt);
  if (!Number.isFinite(last) || last <= 0) return 'active';
  const elapsed = Number(now) - last;
  if (elapsed >= idleTimeoutMs) return 'expired';
  if (elapsed >= idleTimeoutMs - warningBeforeMs) return 'warning';
  return 'active';
}

export function remainingIdleMs({ now, lastActivityAt, idleTimeoutMs = IDLE_TIMEOUT_MS }) {
  const last = Number(lastActivityAt);
  if (!Number.isFinite(last) || last <= 0) return idleTimeoutMs;
  return Math.max(0, idleTimeoutMs - (Number(now) - last));
}

/**
 * Decide whether to send the throttled activity ping now, later (trailing), or not at all.
 * @returns {{ send: boolean, delayMs: number }}
 */
export function planActivityPing({
  now,
  lastPingAt,
  lastActivityAt,
  throttleMs = ACTIVITY_PING_THROTTLE_MS,
}) {
  const ping = Number(lastPingAt) || 0;
  const activity = Number(lastActivityAt) || 0;
  if (activity <= ping) return { send: false, delayMs: 0 };
  const since = Number(now) - ping;
  if (since >= throttleMs) return { send: true, delayMs: 0 };
  return { send: false, delayMs: throttleMs - since };
}

/**
 * Only trusted (user-generated) events count. `focus` counts only when the window itself
 * regains focus; element focus is often programmatic (dialogs, focus restoration).
 */
export function isHumanActivityEvent(event) {
  if (!event || event.isTrusted === false) return false;
  if (event.type === 'focus') {
    return typeof window !== 'undefined' ? event.target === window : event.target === event.currentTarget;
  }
  return ACTIVITY_EVENTS.includes(event.type);
}

export function isSessionEndCode(code) {
  return SESSION_END_CODES.includes(String(code || ''));
}

/**
 * Logout only on 401 responses that carry a session/token code (or no code at all —
 * legacy responses). 403/5xx and business 401s (e.g. wrong current password) keep the session.
 */
export function shouldLogoutForResponse({ status, code, hadAuth }) {
  if (!hadAuth || Number(status) !== 401) return false;
  if (!code) return true;
  return isSessionEndCode(code);
}

export function loginReasonMessage(code) {
  return LOGIN_REASON_MESSAGES_AR[String(code || '')] || '';
}

/**
 * Same-origin, path-only return target. Rejects protocol-relative, absolute URLs,
 * backslashes, control characters, and auth pages (to avoid redirect loops).
 */
export function sanitizeReturnTo(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > 512) return null;
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  const path = s.split(/[?#]/)[0];
  if (/^\/(login|portals|institutions\/login|universities\/login|register|forgot-password)(\/|$)/.test(path)) {
    return null;
  }
  return s;
}

export function loginPathWithReason(loginPath, code) {
  const raw = String(loginPath || '');
  const base = /^\/[a-z0-9/_-]*$/i.test(raw) && !raw.startsWith('//') ? raw : '/portals';
  if (!code) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}reason=${encodeURIComponent(code)}`;
}
