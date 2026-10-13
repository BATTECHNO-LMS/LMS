import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_EVENTS,
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

const MIN = 60_000;

describe('idle policy', () => {
  test('timeout is 30 minutes with a warning 5 minutes before', () => {
    assert.equal(IDLE_TIMEOUT_MS, 30 * MIN);
    assert.equal(IDLE_WARNING_BEFORE_MS, 5 * MIN);
    assert.equal(IDLE_TIMEOUT_MESSAGE_AR, 'انتهت جلستك بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى.');
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

  test('only interaction events count; no mousemove / input / wheel payloads', () => {
    assert.deepEqual([...ACTIVITY_EVENTS].sort(), ['focus', 'keydown', 'pointerdown', 'scroll', 'touchstart']);
    assert.equal(ACTIVITY_EVENTS.includes('mousemove'), false);
    assert.equal(isHumanActivityEvent({ type: 'pointerdown', isTrusted: true }), true);
    assert.equal(isHumanActivityEvent({ type: 'keydown', isTrusted: false }), false);
    assert.equal(isHumanActivityEvent({ type: 'mousemove', isTrusted: true }), false);
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
