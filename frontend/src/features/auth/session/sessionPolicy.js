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

/**
 * DOM events that count as human activity. Payloads (keys, coordinates, text) are never read.
 * `wheel` stands in for user scrolling (`scroll` also fires for programmatic scrolls);
 * keyboard / touch scrolling is covered by keydown / touchstart. Focus, visibility and
 * programmatic route changes are deliberately excluded: an open tab is not activity.
 */
export const ACTIVITY_EVENTS = Object.freeze(['pointerdown', 'keydown', 'touchstart', 'wheel']);

/** Back/forward navigation is user-initiated; in-app links are already covered by pointerdown/keydown. */
export const NAVIGATION_ACTIVITY_EVENT = 'popstate';

/** Cross-tab auth broadcast event types. */
export const AUTH_BROADCAST_EVENTS = Object.freeze({
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
});

const EXPIRY_REASONS = new Set(['SESSION_IDLE_TIMEOUT', 'SESSION_ABSOLUTE_EXPIRED', 'TOKEN_EXPIRED']);

/** Map a logout reason (USER_LOGOUT or a 401 session code) to the broadcast event type. */
export function authBroadcastEvent(reason) {
  const r = String(reason || '');
  if (!r || r === 'USER_LOGOUT') return AUTH_BROADCAST_EVENTS.LOGOUT;
  if (EXPIRY_REASONS.has(r)) return AUTH_BROADCAST_EVENTS.SESSION_EXPIRED;
  return AUTH_BROADCAST_EVENTS.SESSION_REVOKED;
}

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
  'MFA_SESSION_REQUIRED',
]);

export const IDLE_TIMEOUT_MESSAGE_AR = 'انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة. يرجى تسجيل الدخول مرة أخرى.';
export const IDLE_WARNING_MESSAGE_AR = 'ستنتهي جلستك خلال 5 دقائق بسبب عدم النشاط.';

/** Last idle timeout adopted from the server; read by the login page after a timeout. */
export const IDLE_MINUTES_STORAGE_KEY = 'battechno_lms_idle_timeout_minutes';

function arabicMinutes(n) {
  if (n === 1) return 'دقيقة واحدة';
  if (n === 2) return 'دقيقتين';
  if (n >= 3 && n <= 10) return `${n} دقائق`;
  return `${n} دقيقة`;
}

export function idleWarningMessage(warningMinutes = IDLE_WARNING_BEFORE_MS / 60000) {
  return `ستنتهي جلستك خلال ${arabicMinutes(warningMinutes)} بسبب عدم النشاط.`;
}

export function idleTimeoutMessage(idleMinutes = IDLE_TIMEOUT_MS / 60000) {
  const n = Number(idleMinutes);
  const minutes = Number.isInteger(n) && n > 0 ? n : IDLE_TIMEOUT_MS / 60000;
  return `انتهت جلستك بسبب عدم النشاط لمدة ${arabicMinutes(minutes)}. يرجى تسجيل الدخول مرة أخرى.`;
}

const MIN_IDLE_MINUTES = 1;
const MAX_IDLE_MINUTES = 24 * 60;

/**
 * Adopt the server's idle policy (from session ping responses) when it is sane;
 * otherwise keep the built-in 30/5 defaults. The server enforces its own value regardless.
 * @returns {{ idleTimeoutMs: number, warningBeforeMs: number }}
 */
export function resolveIdleConfig(session) {
  const idle = Number(session?.idleTimeoutMinutes);
  const warn = Number(session?.warningMinutes);
  const idleOk = Number.isInteger(idle) && idle >= MIN_IDLE_MINUTES && idle <= MAX_IDLE_MINUTES;
  const idleTimeoutMs = idleOk ? idle * 60000 : IDLE_TIMEOUT_MS;
  const warnOk = Number.isInteger(warn) && warn >= 1 && warn * 60000 < idleTimeoutMs;
  return { idleTimeoutMs, warningBeforeMs: warnOk ? warn * 60000 : Math.min(IDLE_WARNING_BEFORE_MS, idleTimeoutMs / 2) };
}

const LOGIN_REASON_MESSAGES_AR = Object.freeze({
  SESSION_IDLE_TIMEOUT: IDLE_TIMEOUT_MESSAGE_AR,
  SESSION_ABSOLUTE_EXPIRED: 'انتهت مدة جلستك. يرجى تسجيل الدخول مرة أخرى.',
  SESSION_ENDED: 'تم إنهاء جلستك. يرجى تسجيل الدخول مرة أخرى.',
  SESSION_NOT_FOUND: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  TOKEN_EXPIRED: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  TOKEN_INVALID: 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.',
  UNAUTHORIZED: 'يرجى تسجيل الدخول للمتابعة.',
  USER_LOGOUT: 'تم إنهاء الجلسة بنجاح.',
  MFA_SESSION_REQUIRED: 'يتطلب حسابك التحقق الثنائي. يرجى تسجيل الدخول مرة أخرى.',
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

/** Only trusted (user-generated) events of the listed types count. */
export function isHumanActivityEvent(event) {
  if (!event || event.isTrusted === false) return false;
  return ACTIVITY_EVENTS.includes(event.type) || event.type === NAVIGATION_ACTIVITY_EVENT;
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

export function loginReasonMessage(code, { idleMinutes } = {}) {
  if (code === 'SESSION_IDLE_TIMEOUT' && idleMinutes) return idleTimeoutMessage(idleMinutes);
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
