import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_EVENTS,
  AUTH_BROADCAST_EVENTS,
  NAVIGATION_ACTIVITY_EVENT,
  authBroadcastEvent,
  idleTimeoutMessage,
  idleWarningMessage,
  resolveIdleConfig,
  IDLE_TIMEOUT_MESSAGE_AR,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_BEFORE_MS,
  IDLE_WARNING_MESSAGE_AR,
  computeIdleState,
  isHumanActivityEvent,
  isSessionEndCode,
  loginPathWithReason,
  loginReasonMessage,
  planActivityPing,
  remainingIdleMs,
  sanitizeReturnTo,
  shouldLogoutForResponse,
} from '../src/features/auth/session/sessionPolicy.js';
import { getRememberedPortalLoginPath, portalTypeFromToken } from '../src/utils/portal.js';

const MIN = 60_000;

describe('idle policy', () => {
  test('timeout is 30 minutes with a warning 5 minutes before', () => {
    assert.equal(IDLE_TIMEOUT_MS, 30 * MIN);
    assert.equal(IDLE_WARNING_BEFORE_MS, 5 * MIN);
    assert.equal(IDLE_TIMEOUT_MESSAGE_AR, 'انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة. يرجى تسجيل الدخول مرة أخرى.');
    assert.equal(IDLE_WARNING_MESSAGE_AR, 'ستنتهي جلستك خلال 5 دقائق بسبب عدم النشاط.');
  });

  test('active → warning at 25 minutes → expired at 30 minutes', () => {
    const last = 1_000_000;
    assert.equal(computeIdleState({ now: last + 24 * MIN, lastActivityAt: last }), 'active');
    assert.equal(computeIdleState({ now: last + 25 * MIN, lastActivityAt: last }), 'warning');
    assert.equal(computeIdleState({ now: last + 30 * MIN - 1, lastActivityAt: last }), 'warning');
    assert.equal(computeIdleState({ now: last + 30 * MIN, lastActivityAt: last }), 'expired');
  });

  test('remaining time never negative', () => {
    assert.equal(remainingIdleMs({ now: 10 * MIN, lastActivityAt: 0 + 1 }), 20 * MIN + 1);
    assert.equal(remainingIdleMs({ now: 100 * MIN, lastActivityAt: 1 }), 0);
  });

  test('only interaction events count; no mousemove / focus / programmatic scroll', () => {
    assert.deepEqual([...ACTIVITY_EVENTS].sort(), ['keydown', 'pointerdown', 'touchstart', 'wheel']);
    for (const type of ['mousemove', 'scroll', 'focus', 'visibilitychange', 'input']) {
      assert.equal(ACTIVITY_EVENTS.includes(type), false, type);
      assert.equal(isHumanActivityEvent({ type, isTrusted: true }), false, type);
    }
    assert.equal(isHumanActivityEvent({ type: 'pointerdown', isTrusted: true }), true);
    assert.equal(isHumanActivityEvent({ type: 'wheel', isTrusted: true }), true);
    assert.equal(isHumanActivityEvent({ type: NAVIGATION_ACTIVITY_EVENT, isTrusted: true }), true);
    assert.equal(isHumanActivityEvent({ type: 'keydown', isTrusted: false }), false);
  });

  test('server idle config is adopted only when sane', () => {
    assert.deepEqual(resolveIdleConfig({ idleTimeoutMinutes: 30, warningMinutes: 5 }), {
      idleTimeoutMs: 30 * MIN,
      warningBeforeMs: 5 * MIN,
    });
    assert.deepEqual(resolveIdleConfig({ idleTimeoutMinutes: 45, warningMinutes: 10 }), {
      idleTimeoutMs: 45 * MIN,
      warningBeforeMs: 10 * MIN,
    });
    assert.deepEqual(resolveIdleConfig(null), { idleTimeoutMs: IDLE_TIMEOUT_MS, warningBeforeMs: IDLE_WARNING_BEFORE_MS });
    assert.equal(resolveIdleConfig({ idleTimeoutMinutes: 0 }).idleTimeoutMs, IDLE_TIMEOUT_MS);
    assert.equal(resolveIdleConfig({ idleTimeoutMinutes: 'x' }).idleTimeoutMs, IDLE_TIMEOUT_MS);
    assert.equal(resolveIdleConfig({ idleTimeoutMinutes: 30, warningMinutes: 30 }).warningBeforeMs, 5 * MIN);
    assert.deepEqual(resolveIdleConfig({ idleTimeoutMinutes: 2, warningMinutes: 1 }), { idleTimeoutMs: 2 * MIN, warningBeforeMs: MIN });
  });

  test('warning / timeout messages reflect the configured minutes (production text unchanged)', () => {
    assert.equal(idleWarningMessage(5), IDLE_WARNING_MESSAGE_AR);
    assert.equal(idleWarningMessage(10), 'ستنتهي جلستك خلال 10 دقائق بسبب عدم النشاط.');
    assert.equal(idleWarningMessage(1), 'ستنتهي جلستك خلال دقيقة واحدة بسبب عدم النشاط.');
    assert.equal(idleTimeoutMessage(30), IDLE_TIMEOUT_MESSAGE_AR);
    assert.equal(idleTimeoutMessage(), IDLE_TIMEOUT_MESSAGE_AR);
    assert.equal(idleTimeoutMessage(2), 'انتهت جلستك بسبب عدم النشاط لمدة دقيقتين. يرجى تسجيل الدخول مرة أخرى.');
    assert.equal(loginReasonMessage('SESSION_IDLE_TIMEOUT', { idleMinutes: 45 }), idleTimeoutMessage(45));
  });
});

describe('portal login after session end', () => {
  test('portal is read from the JWT claim; unknown / malformed tokens fall back', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = (claims) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
    assert.equal(portalTypeFromToken(token({ portalType: 'UNIVERSITY', userId: 'ü' })), 'UNIVERSITY');
    assert.equal(portalTypeFromToken(token({ portalType: 'INSTITUTION' })), 'INSTITUTION');
    assert.equal(portalTypeFromToken(token({ portalType: 'ADMIN' })), null);
    assert.equal(portalTypeFromToken('garbage'), null);
    assert.equal(portalTypeFromToken(null), null);
    assert.equal(getRememberedPortalLoginPath('UNIVERSITY'), '/universities/login');
    assert.equal(getRememberedPortalLoginPath('INSTITUTION'), '/institutions/login');
  });
});

describe('cross-tab broadcast events', () => {
  test('logout, expiry and revocation are distinguished', () => {
    assert.equal(authBroadcastEvent('USER_LOGOUT'), AUTH_BROADCAST_EVENTS.LOGOUT);
    assert.equal(authBroadcastEvent('SESSION_IDLE_TIMEOUT'), AUTH_BROADCAST_EVENTS.SESSION_EXPIRED);
    assert.equal(authBroadcastEvent('SESSION_ABSOLUTE_EXPIRED'), AUTH_BROADCAST_EVENTS.SESSION_EXPIRED);
    assert.equal(authBroadcastEvent('TOKEN_EXPIRED'), AUTH_BROADCAST_EVENTS.SESSION_EXPIRED);
    assert.equal(authBroadcastEvent('SESSION_ENDED'), AUTH_BROADCAST_EVENTS.SESSION_REVOKED);
    assert.equal(authBroadcastEvent('SESSION_NOT_FOUND'), AUTH_BROADCAST_EVENTS.SESSION_REVOKED);
  });
});

describe('activity ping throttle', () => {
  test('first activity sends immediately', () => {
    assert.deepEqual(planActivityPing({ now: 100 * MIN, lastPingAt: 0, lastActivityAt: 100 * MIN }), {
      send: true,
      delayMs: 0,
    });
  });

  test('activity within 60s of the last ping schedules a trailing ping', () => {
    const plan = planActivityPing({ now: 10 * MIN + 20_000, lastPingAt: 10 * MIN, lastActivityAt: 10 * MIN + 20_000 });
    assert.equal(plan.send, false);
    assert.equal(plan.delayMs, 40_000);
  });

  test('no new activity since last ping → nothing to send', () => {
    assert.deepEqual(planActivityPing({ now: 20 * MIN, lastPingAt: 10 * MIN, lastActivityAt: 9 * MIN }), {
      send: false,
      delayMs: 0,
    });
  });
});

describe('logout decision', () => {
  test('401 with session codes logs out', () => {
    for (const code of ['SESSION_IDLE_TIMEOUT', 'SESSION_ENDED', 'SESSION_NOT_FOUND', 'TOKEN_EXPIRED', 'TOKEN_INVALID']) {
      assert.equal(isSessionEndCode(code), true);
      assert.equal(shouldLogoutForResponse({ status: 401, code, hadAuth: true }), true);
    }
  });

  test('403 and 500 never log out', () => {
    assert.equal(shouldLogoutForResponse({ status: 403, code: 'FORBIDDEN', hadAuth: true }), false);
    assert.equal(shouldLogoutForResponse({ status: 500, code: 'SERVER_ERROR', hadAuth: true }), false);
    assert.equal(shouldLogoutForResponse({ status: 403, code: 'SESSION_ENDED', hadAuth: true }), false);
  });

  test('business 401 codes and anonymous requests do not log out', () => {
    assert.equal(shouldLogoutForResponse({ status: 401, code: 'INVALID_CURRENT_PASSWORD', hadAuth: true }), false);
    assert.equal(shouldLogoutForResponse({ status: 401, code: 'SESSION_ENDED', hadAuth: false }), false);
  });
});

describe('login redirect', () => {
  test('timeout message for idle code', () => {
    assert.equal(loginReasonMessage('SESSION_IDLE_TIMEOUT'), IDLE_TIMEOUT_MESSAGE_AR);
    assert.equal(loginReasonMessage('nonsense'), '');
  });

  test('login path carries the reason and rejects unsafe paths', () => {
    assert.equal(loginPathWithReason('/universities/login', 'SESSION_IDLE_TIMEOUT'), '/universities/login?reason=SESSION_IDLE_TIMEOUT');
    assert.equal(loginPathWithReason('//evil.example', 'X'), '/portals?reason=X');
    assert.equal(loginPathWithReason('https://evil.example', null), '/portals');
  });

  test('returnTo only accepts same-origin app paths', () => {
    assert.equal(sanitizeReturnTo('/student/courses/1?tab=x'), '/student/courses/1?tab=x');
    assert.equal(sanitizeReturnTo('//evil.example/x'), null);
    assert.equal(sanitizeReturnTo('https://evil.example'), null);
    assert.equal(sanitizeReturnTo('/\\evil.example'), null);
    assert.equal(sanitizeReturnTo('/javascript:alert(1)'), null);
    assert.equal(sanitizeReturnTo('/login/student'), null);
    assert.equal(sanitizeReturnTo('/universities/login'), null);
    assert.equal(sanitizeReturnTo('relative/path'), null);
    assert.equal(sanitizeReturnTo(undefined), null);
  });
});
