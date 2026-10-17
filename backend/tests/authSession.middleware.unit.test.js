'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { env, parseTrustProxySetting } = require('../src/config/env');
const { authenticate } = require('../src/middlewares/auth.middleware');
const { credentialAttemptKey } = require('../src/middlewares/rateLimit.middleware');
const authSessions = require('../src/modules/auth/authSession.service');
const { signToken, verifyToken } = require('../src/utils/jwt');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const { installAuditCapture } = require('./helpers/auditCapture');
const { createMockReq, runMiddlewareAsync } = require('./helpers/authzFixtures');

const USER = '11111111-1111-4111-8111-111111111111';
const SID_IDLE = '44444444-4444-4444-8444-444444444441';
const SID_ENDED = '44444444-4444-4444-8444-444444444442';
const SID_ABS = '44444444-4444-4444-8444-444444444443';
const SID_OTHER = '44444444-4444-4444-8444-444444444444';
const MIN = 60_000;
const SECRET = env.JWT_SECRET || 'battechno-dev-only-change-me';

function bearer(token) {
  return createMockReq({ method: 'GET', headers: { authorization: `Bearer ${token}` } });
}

describe('authenticate → server-side session codes', () => {
  let audit;
  before(() => {
    audit = installAuditCapture();
    const now = Date.now();
    const base = { user_id: USER, created_at: new Date(now - 120 * MIN), last_seen_at: new Date(now), ended_at: null, end_reason: null, is_active: true };
    const rows = {
      [SID_IDLE]: { ...base, id: SID_IDLE, last_activity_at: new Date(now - 31 * MIN), absolute_expires_at: new Date(now + 600 * MIN) },
      [SID_ENDED]: { ...base, id: SID_ENDED, last_activity_at: new Date(now - MIN), absolute_expires_at: new Date(now + 600 * MIN), ended_at: new Date(now - MIN), end_reason: 'USER_LOGOUT', is_active: false },
      [SID_ABS]: { ...base, id: SID_ABS, last_activity_at: new Date(now - MIN), absolute_expires_at: new Date(now - 1000) },
      [SID_OTHER]: { ...base, id: SID_OTHER, user_id: '99999999-9999-4999-8999-999999999999', last_activity_at: new Date(now), absolute_expires_at: new Date(now + 600 * MIN) },
    };
    authSessions.setAuthSessionStoreForTests({
      async findById(id) { return rows[id] ? { ...rows[id] } : null; },
      async create() { throw new Error('unused'); },
      async endIfOpen(id, { endReason, endedAt }) {
        const r = rows[id];
        if (!r || r.ended_at) return false;
        Object.assign(r, { ended_at: endedAt, end_reason: endReason, is_active: false });
        return true;
      },
      async touchActivity() { return { updated: false, firstActivity: false }; },
      async touchPresence() { return true; },
      async findExpiredOpen() { return []; },
      async listOpenForUser() { return []; },
      async listForUser() { return []; },
    });
  });
  after(() => {
    authSessions.resetAuthSessionStoreForTests();
    audit.restore();
  });

  it('legacy JWT without sid → 401 SESSION_NOT_FOUND', async () => {
    const legacy = jwt.sign({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'] }, SECRET, { expiresIn: '1h' });
    const out = await runMiddlewareAsync(authenticate, bearer(legacy));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'SESSION_NOT_FOUND');
  });

  it('idle session → 401 SESSION_IDLE_TIMEOUT with the Arabic message, ended once', async () => {
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID_IDLE });
    const out = await runMiddlewareAsync(authenticate, bearer(token));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'SESSION_IDLE_TIMEOUT');
    assert.equal(out.body.message, 'انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة. يرجى تسجيل الدخول مرة أخرى.');
    await runMiddlewareAsync(authenticate, bearer(token));
    assert.equal(audit.byAction('AUTH_SESSION_IDLE_TIMEOUT').length, 1);
  });

  it('logged-out session (old JWT) → 401 SESSION_ENDED', async () => {
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID_ENDED });
    const out = await runMiddlewareAsync(authenticate, bearer(token));
    assert.equal(out.body.code, 'SESSION_ENDED');
  });

  it('absolute expiry → 401 SESSION_ABSOLUTE_EXPIRED', async () => {
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID_ABS });
    const out = await runMiddlewareAsync(authenticate, bearer(token));
    assert.equal(out.body.code, 'SESSION_ABSOLUTE_EXPIRED');
  });

  it('sid belonging to another user → 401 SESSION_NOT_FOUND + TOKEN_INVALID audit (no JWT stored)', async () => {
    audit.clear();
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID_OTHER });
    const out = await runMiddlewareAsync(authenticate, bearer(token));
    assert.equal(out.body.code, 'SESSION_NOT_FOUND');
    await new Promise((r) => setImmediate(r));
    const rows = audit.byAction('TOKEN_INVALID');
    assert.equal(rows.length, 1);
    assert.equal(JSON.stringify(rows).includes(token), false);
    assert.equal(JSON.stringify(rows).includes(token.split('.')[2]), false);
  });

  it('bad signature → 401 TOKEN_INVALID; expired → TOKEN_EXPIRED', async () => {
    const forged = jwt.sign({ userId: USER, portalType: 'UNIVERSITY', sid: SID_IDLE }, 'not-the-secret');
    assert.equal((await runMiddlewareAsync(authenticate, bearer(forged))).body.code, 'TOKEN_INVALID');
    const expired = jwt.sign({ userId: USER, portalType: 'UNIVERSITY', sid: SID_IDLE, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    assert.equal((await runMiddlewareAsync(authenticate, bearer(expired))).body.code, 'TOKEN_EXPIRED');
  });

  it('signed tokens carry sid and keep existing claims', () => {
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID_IDLE });
    const payload = jwt.decode(token);
    const header = jwt.decode(token, { complete: true }).header;
    assert.equal(header.alg, 'HS256');
    assert.equal(payload.sid, SID_IDLE);
    assert.equal(payload.userId, USER);
    assert.equal(payload.portalType, 'UNIVERSITY');
    assert.ok(payload.exp - payload.iat <= env.AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS * 3600, 'expiry bounded by absolute lifetime');
  });

  it('alg=none and non-HS256 algorithms are rejected', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const claims = { userId: USER, portalType: 'UNIVERSITY', sid: SID_OTHER, iat: Math.floor(Date.now() / 1000) };
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
    assert.equal((await runMiddlewareAsync(authenticate, bearer(unsigned))).body.code, 'TOKEN_INVALID');
    const hs512 = jwt.sign(claims, SECRET, { algorithm: 'HS512' });
    assert.equal((await runMiddlewareAsync(authenticate, bearer(hs512))).body.code, 'TOKEN_INVALID');
    assert.throws(() => verifyToken(hs512), /invalid algorithm/);
  });

  it('issuer / audience are enforced when configured', () => {
    const prev = { iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE };
    try {
      const plain = signToken({ userId: USER, portalType: 'UNIVERSITY', sessionId: SID_IDLE });
      env.JWT_ISSUER = 'eprojecto-api';
      env.JWT_AUDIENCE = 'eprojecto-web';
      const scoped = signToken({ userId: USER, portalType: 'UNIVERSITY', sessionId: SID_IDLE });
      assert.equal(jwt.decode(scoped).iss, 'eprojecto-api');
      assert.equal(verifyToken(scoped).sid, SID_IDLE);
      assert.throws(() => verifyToken(plain), /jwt issuer invalid|jwt audience invalid/);
      const wrongAud = jwt.sign({ userId: USER, sid: SID_IDLE }, SECRET, { issuer: 'eprojecto-api', audience: 'other' });
      assert.throws(() => verifyToken(wrongAud), /jwt audience invalid/);
    } finally {
      env.JWT_ISSUER = prev.iss;
      env.JWT_AUDIENCE = prev.aud;
    }
  });
});

describe('authenticate → background traffic never extends the idle window', () => {
  const SID = '55555555-5555-4555-8555-555555555555';
  const calls = { activity: 0, presence: 0 };
  let row;

  before(() => {
    const now = Date.now();
    row = {
      id: SID,
      user_id: USER,
      created_at: new Date(now - 20 * MIN),
      last_activity_at: new Date(now - 20 * MIN),
      last_seen_at: new Date(now - 10 * MIN),
      absolute_expires_at: new Date(now + 600 * MIN),
      ended_at: null,
      end_reason: null,
      is_active: true,
    };
    authSessions.setAuthSessionStoreForTests({
      async findById(id) { return id === SID ? { ...row } : null; },
      async create() { throw new Error('unused'); },
      async endIfOpen() { return false; },
      async touchActivity() { calls.activity += 1; return { updated: true, firstActivity: false }; },
      async touchPresence(id, when) { calls.presence += 1; row.last_seen_at = when; return true; },
      async findExpiredOpen() { return []; },
      async listOpenForUser() { return []; },
      async listForUser() { return []; },
    });
    setCurrentAuthContextLoaderForTests(async (userId) => ({ userId, roles: ['student'], permissions: [], isGlobal: false }));
  });
  after(() => {
    authSessions.resetAuthSessionStoreForTests();
    resetCurrentAuthContextLoaderForTests();
  });

  it('SSE, polling, recorded-lecture heartbeat, notifications and presence only touch last_seen_at (throttled)', async () => {
    const token = signToken({ userId: USER, portalType: 'UNIVERSITY', roles: ['student'], sessionId: SID });
    const lastActivityBefore = row.last_activity_at.getTime();
    const paths = [
      ['GET', '/api/v1/analytics/command-center/live'],
      ['GET', '/api/v1/training-programs/sessions/x/attendance/status'],
      ['POST', '/api/v1/student/field-training/x/recorded-lectures/y/heartbeat'],
      ['GET', '/api/v1/notifications'],
      ['GET', '/api/v1/notifications/unread-count'],
      ['POST', '/api/v1/auth/session/presence'],
      ['GET', '/api/v1/auth/me'],
    ];
    let allowed = 0;
    for (let round = 0; round < 20; round += 1) {
      for (const [method, url] of paths) {
        const req = createMockReq({ method, originalUrl: url, url, headers: { authorization: `Bearer ${token}` } });
        // eslint-disable-next-line no-await-in-loop
        const out = await runMiddlewareAsync(authenticate, req);
        if (out.nextCalled) allowed += 1;
      }
    }
    await new Promise((r) => setImmediate(r));
    assert.equal(allowed, 20 * paths.length, 'all background requests authenticated');
    assert.equal(calls.activity, 0, 'no request extended the idle window');
    assert.equal(row.last_activity_at.getTime(), lastActivityBefore);
    assert.ok(calls.presence <= 1, `presence writes throttled (got ${calls.presence} for ${allowed} requests)`);
  });
});

describe('proxy trust and limiter keys', () => {
  it('trust proxy is never a blanket true', () => {
    assert.equal(parseTrustProxySetting(undefined).description, 'subnets=loopback hops=1');
    assert.equal(parseTrustProxySetting('false').description, 'subnets=loopback hops=1');
    assert.equal(parseTrustProxySetting('true').description, 'subnets=loopback,uniquelocal hops=2');
    assert.equal(parseTrustProxySetting('2').description, 'subnets=loopback,uniquelocal hops=2');
    assert.equal(
      parseTrustProxySetting('loopback,172.16.0.0/12').description,
      'subnets=loopback,172.16.0.0/12 hops=2'
    );
    for (const raw of [undefined, '', 'true', 'false', '1']) {
      const trust = parseTrustProxySetting(raw);
      assert.notEqual(trust, true);
      assert.equal(trust('203.0.113.7', 0), false, 'public addresses are never proxies');
    }
  });

  it('credential limiter keys on the real client + normalized identifier', () => {
    const a = credentialAttemptKey({ ip: '203.0.113.7', body: { email: '  Student@Uni.EDU ' } });
    const b = credentialAttemptKey({ ip: '203.0.113.7', body: { email: 'student@uni.edu' } });
    const c = credentialAttemptKey({ ip: '198.51.100.2', body: { email: 'student@uni.edu' } });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.includes('password'), false);
  });
});
