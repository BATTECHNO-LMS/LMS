'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { env } = require('../src/config/env');
const { authenticate } = require('../src/middlewares/auth.middleware');
const authSessions = require('../src/modules/auth/authSession.service');
const sessionManagement = require('../src/modules/auth/sessionManagement.service');
const { requireStepUp, assertStepUp } = require('../src/modules/auth/mfa/stepUp');
const { describeUserAgent, maskIpAddress } = require('../src/shared/security/deviceLabel');
const { signToken } = require('../src/utils/jwt');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const { resetSecurityEventDedupeForTests } = require('../src/shared/security/securityEvents');
const { installAuditCapture } = require('./helpers/auditCapture');
const { makeFakeSessionStore } = require('./helpers/fakeMfaStore');
const { createMockReq, runMiddlewareAsync } = require('./helpers/authzFixtures');

const ADMIN = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';

const CONTEXTS = {
  [ADMIN]: { roles: ['admin'], isGlobal: false, permissions: [] },
  [STUDENT]: { roles: ['student'], isGlobal: false, permissions: [] },
  [OTHER]: { roles: ['trainer'], isGlobal: false, permissions: [], _assignmentRows: [{ role_code: 'admin' }] },
};

function bearer(userId, sid) {
  const token = signToken({ userId, portalType: 'UNIVERSITY', roles: CONTEXTS[userId].roles, sessionId: sid });
  return createMockReq({ method: 'GET', headers: { authorization: `Bearer ${token}` } });
}

describe('MFA enforcement in the auth middleware', () => {
  let audit;
  let sessions;
  before(() => {
    audit = installAuditCapture();
    setCurrentAuthContextLoaderForTests(async (userId) => ({ userId, ...CONTEXTS[userId] }));
  });
  after(() => {
    authSessions.resetAuthSessionStoreForTests();
    resetCurrentAuthContextLoaderForTests();
    audit.restore();
  });
  beforeEach(() => {
    sessions = makeFakeSessionStore();
    authSessions.setAuthSessionStoreForTests(sessions);
    resetSecurityEventDedupeForTests();
    audit.clear();
  });

  it('admin with a password-only session → 401 MFA_SESSION_REQUIRED (never reaches the app)', async () => {
    const s = await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY' });
    const out = await runMiddlewareAsync(authenticate, bearer(ADMIN, s.id));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'MFA_SESSION_REQUIRED');
    assert.equal(audit.byAction('AUTHORIZATION_DENIED').length, 1);
  });

  it('institution admin (admin via organization assignment) is enforced too', async () => {
    const s = await authSessions.createSession({ userId: OTHER, portalType: 'UNIVERSITY' });
    const out = await runMiddlewareAsync(authenticate, bearer(OTHER, s.id));
    assert.equal(out.body.code, 'MFA_SESSION_REQUIRED');
  });

  it('admin with an MFA session passes; assurance is exposed on req.user from the session row', async () => {
    const at = new Date();
    const s = await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY', authenticationLevel: 'MFA', mfaVerifiedAt: at });
    const req = bearer(ADMIN, s.id);
    const out = await runMiddlewareAsync(authenticate, req);
    assert.equal(out.nextCalled, true);
    assert.equal(req.user.authenticationLevel, 'MFA');
    assert.equal(new Date(req.user.mfaVerifiedAt).getTime(), at.getTime());
  });

  it('optional roles (student) keep password-only sessions', async () => {
    const s = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    const out = await runMiddlewareAsync(authenticate, bearer(STUDENT, s.id));
    assert.equal(out.nextCalled, true);
  });

  it('a forged amr claim cannot raise assurance (server reads the session row)', async () => {
    const s = await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY' });
    const token = signToken({ userId: ADMIN, portalType: 'UNIVERSITY', roles: ['admin'], sessionId: s.id, amr: ['pwd', 'otp'] });
    const out = await runMiddlewareAsync(authenticate, createMockReq({ method: 'GET', headers: { authorization: `Bearer ${token}` } }));
    assert.equal(out.body.code, 'MFA_SESSION_REQUIRED');
  });
});

describe('step-up (STEP_UP_REQUIRED)', () => {
  it('fresh MFA proof passes; stale or missing → 403 STEP_UP_REQUIRED with the window', async () => {
    const fresh = await runMiddlewareAsync(requireStepUp, createMockReq({ user: { userId: ADMIN, mfaVerifiedAt: new Date() } }));
    assert.equal(fresh.nextCalled, true);
    assert.equal(fresh.nextErr, null);

    const stale = new Date(Date.now() - (env.MFA_STEP_UP_MAX_AGE_MINUTES + 1) * 60_000);
    for (const user of [{ userId: ADMIN, mfaVerifiedAt: stale }, { userId: ADMIN, mfaVerifiedAt: null }, undefined]) {
      assert.throws(() => assertStepUp(user), (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'STEP_UP_REQUIRED');
        assert.equal(err.details.maxAgeMinutes, env.MFA_STEP_UP_MAX_AGE_MINUTES);
        return true;
      });
    }
  });
});

describe('own session management (no IDOR)', () => {
  let audit;
  let sessions;
  before(() => {
    audit = installAuditCapture();
  });
  after(() => {
    authSessions.resetAuthSessionStoreForTests();
    audit.restore();
  });
  beforeEach(() => {
    sessions = makeFakeSessionStore();
    authSessions.setAuthSessionStoreForTests(sessions);
    resetSecurityEventDedupeForTests();
    audit.clear();
  });

  const UA_CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
  const UA_SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  it('lists only my sessions with device label, masked IP, current badge — no raw UA / IP', async () => {
    const current = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY', ipAddress: '203.0.113.45', userAgent: UA_CHROME_WIN });
    await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY', ipAddress: '198.51.100.7', userAgent: UA_SAFARI_IPHONE });
    await authSessions.createSession({ userId: OTHER, portalType: 'UNIVERSITY', ipAddress: '192.0.2.1', userAgent: UA_CHROME_WIN });
    const { sessions: list, activeCount } = await sessionManagement.listOwnSessions({ userId: STUDENT, currentSessionId: current.id });
    assert.equal(list.length, 2);
    assert.equal(activeCount, 2);
    assert.equal(list[0].isCurrent, true);
    assert.equal(list[0].device, 'Chrome on Windows');
    assert.equal(list[0].ipApprox, '203.0.113.x');
    assert.equal(list[1].device, 'Safari on iPhone');
    const json = JSON.stringify(list);
    for (const leak of ['203.0.113.45', '198.51.100.7', '192.0.2.1', 'Mozilla/5.0', 'user_agent', 'ip_address']) {
      assert.equal(json.includes(leak), false, leak);
    }
  });

  it('ending another user\'s session → 404 (indistinguishable) + denial event; session untouched', async () => {
    const mine = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    const theirs = await authSessions.createSession({ userId: OTHER, portalType: 'UNIVERSITY' });
    const req = createMockReq({ method: 'POST', user: { userId: STUDENT }, originalUrl: `/api/v1/auth/sessions/${theirs.id}/end` });
    await assert.rejects(
      sessionManagement.endOwnSession({ userId: STUDENT, currentSessionId: mine.id, sessionId: theirs.id, req }),
      (err) => err.statusCode === 404
    );
    assert.equal(sessions.rows.get(theirs.id).ended_at, null);
    assert.equal(audit.byAction('AUTHORIZATION_DENIED').length, 1);
    await assert.rejects(
      sessionManagement.endOwnSession({ userId: STUDENT, currentSessionId: mine.id, sessionId: '99999999-9999-4999-8999-999999999999', req }),
      (err) => err.statusCode === 404
    );
  });

  it('ending one of my other sessions → USER_REVOKED / AUTH_SESSION_ENDED; current stays open', async () => {
    const current = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    const phone = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    audit.clear();
    const res = await sessionManagement.endOwnSession({ userId: STUDENT, currentSessionId: current.id, sessionId: phone.id });
    assert.deepEqual(res, { ended: true, endedCurrent: false });
    assert.equal(sessions.rows.get(phone.id).end_reason, 'USER_REVOKED');
    assert.equal(sessions.rows.get(current.id).ended_at, null);
    assert.equal(audit.byAction('AUTH_SESSION_ENDED').length, 1);
    const verdict = await authSessions.validateSession({ sid: phone.id, userId: STUDENT });
    assert.equal(verdict.code, 'SESSION_ENDED', 'revocation is immediate');
  });

  it('ending the current session is a logout (USER_LOGOUT)', async () => {
    const current = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    const res = await sessionManagement.endOwnSession({ userId: STUDENT, currentSessionId: current.id, sessionId: current.id });
    assert.equal(res.endedCurrent, true);
    assert.equal(sessions.rows.get(current.id).end_reason, 'USER_LOGOUT');
  });

  it('end all other sessions: one semantic event, per-session events suppressed, current kept', async () => {
    const current = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    const foreign = await authSessions.createSession({ userId: OTHER, portalType: 'UNIVERSITY' });
    audit.clear();
    const res = await sessionManagement.endOtherOwnSessions({ userId: STUDENT, currentSessionId: current.id });
    assert.equal(res.sessionsEnded, 2);
    assert.equal(sessions.rows.get(current.id).ended_at, null);
    assert.equal(sessions.rows.get(foreign.id).ended_at, null);
    assert.ok([...sessions.rows.values()].filter((r) => r.user_id === STUDENT && r.ended_at).every((r) => r.end_reason === 'USER_REVOKED_OTHER_SESSIONS'));
    assert.equal(audit.byAction('AUTH_OTHER_SESSIONS_ENDED').length, 1);
    assert.equal(audit.byAction('AUTH_OTHER_SESSIONS_ENDED')[0].new_values.sessionsEnded, 2);
    assert.equal(audit.byAction('AUTH_SESSION_ENDED').length, 0);
  });

  it('endAllUserSessions + MFA_RESET emit AUTH_SESSION_REVOKED', async () => {
    await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY' });
    audit.clear();
    assert.equal(await authSessions.endAllUserSessions(STUDENT, 'MFA_RESET', { actorUserId: ADMIN }), 1);
    assert.equal(audit.byAction('AUTH_SESSION_REVOKED')[0].new_values.endReason, 'MFA_RESET');
  });
});

describe('device label / IP masking', () => {
  it('coarse browser + OS only', () => {
    assert.equal(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15').label, 'Safari on macOS');
    assert.equal(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0').label, 'Edge on Windows');
    assert.equal(describeUserAgent('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36').label, 'Chrome on Android');
    assert.equal(describeUserAgent('').label, null);
  });
  it('masks IPv4 / IPv6 / mapped addresses', () => {
    assert.equal(maskIpAddress('203.0.113.45'), '203.0.113.x');
    assert.equal(maskIpAddress('::ffff:203.0.113.45'), '203.0.113.x');
    assert.equal(maskIpAddress('2001:db8:85a3:8d3:1319:8a2e:370:7348'), '2001:db8:85a3::');
    assert.equal(maskIpAddress(''), null);
    assert.equal(maskIpAddress('garbage'), null);
  });
});
