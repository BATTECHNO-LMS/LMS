'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { installAuditCapture } = require('./helpers/auditCapture');
const authRepository = require('../src/modules/auth/auth.repository');
const authService = require('../src/modules/auth/auth.service');
const { hashPassword } = require('../src/utils/password');
const loginThrottle = require('../src/modules/auth/loginThrottle');
const { loginThrottleGuard } = require('../src/modules/auth/loginThrottle.middleware');
const { resetSecurityEventDedupeForTests } = require('../src/shared/security/securityEvents');
const { env } = require('../src/config/env');

const PASSWORD = 'Correct#Pass-123';
const WRONG = 'Wrong#Pass-999';
const IP = '203.0.113.10';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function user(overrides = {}) {
  return {
    id: USER_ID,
    email: 'student.one@example.edu',
    full_name: 'Student One',
    status: 'active',
    email_verified_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

async function attempt(email, password) {
  try {
    await authService.login({ email, password, portalType: 'university', ipAddress: IP, userAgent: 'test-agent' });
    return null;
  } catch (err) {
    return err;
  }
}

describe('login security events', () => {
  let capture;
  let passwordHash;
  let currentUser = null;
  const originalFind = authRepository.findUserByEmail;

  before(async () => {
    capture = installAuditCapture();
    passwordHash = await hashPassword(PASSWORD);
    authRepository.findUserByEmail = async () => (currentUser ? { ...currentUser, password_hash: passwordHash } : null);
  });
  after(() => {
    authRepository.findUserByEmail = originalFind;
    capture.restore();
  });
  beforeEach(() => {
    capture.clear();
    currentUser = null;
    loginThrottle.resetLoginThrottleForTests();
    resetSecurityEventDedupeForTests();
  });

  it('wrong password → USER_LOGIN_FAILED (INVALID_PASSWORD), no secrets stored', async () => {
    currentUser = user();
    const err = await attempt('Student.One@example.edu', WRONG);
    assert.equal(err.code, 'INVALID_CREDENTIALS');
    const [row] = capture.byAction('USER_LOGIN_FAILED');
    assert.ok(row);
    assert.equal(row.outcome, 'FAILED');
    assert.equal(row.security_category, 'AUTHENTICATION');
    assert.equal(row.subject_user_id, USER_ID);
    assert.equal(row.ip_address, IP);
    assert.equal(row.new_values.reason, 'INVALID_PASSWORD');
    const serialized = JSON.stringify(capture.rows);
    assert.ok(!serialized.includes(WRONG));
    assert.ok(!serialized.includes(PASSWORD));
    assert.ok(!serialized.includes(passwordHash));
    assert.ok(!serialized.includes('student.one@example.edu'), 'raw identifier is masked');
  });

  it('unknown email → same public error, internal reason ACCOUNT_NOT_FOUND_OR_INVALID', async () => {
    currentUser = user();
    const known = await attempt('student.one@example.edu', WRONG);
    currentUser = null;
    const unknown = await attempt('nobody@example.edu', WRONG);
    assert.equal(unknown.code, known.code);
    assert.equal(unknown.statusCode, known.statusCode);
    assert.equal(unknown.message, known.message);
    const rows = capture.byAction('USER_LOGIN_FAILED');
    assert.equal(rows[1].new_values.reason, 'ACCOUNT_NOT_FOUND_OR_INVALID');
    assert.equal(rows[1].subject_user_id, null);
  });

  for (const [label, overrides, code] of [
    ['suspended', { status: 'suspended' }, 'ACCOUNT_DISABLED'],
    ['pending activation', { status: 'inactive' }, 'ACCOUNT_PENDING_ACTIVATION'],
    ['rejected', { status: 'rejected' }, 'ACCOUNT_REJECTED'],
    ['unverified email', { email_verified_at: null }, 'EMAIL_NOT_VERIFIED'],
  ]) {
    it(`${label} account with the correct password → LOGIN_ACCOUNT_DENIED (${code})`, async () => {
      currentUser = user(overrides);
      const err = await attempt('student.one@example.edu', PASSWORD);
      assert.equal(err.code, code);
      const rows = capture.byAction('LOGIN_ACCOUNT_DENIED');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].outcome, 'DENIED');
      assert.equal(rows[0].new_values.reason, code);
      assert.equal(capture.byAction('USER_LOGIN_FAILED').length, 0);
    });
  }

  it('suspended account with a wrong password does not reveal the status', async () => {
    currentUser = user({ status: 'suspended' });
    const err = await attempt('student.one@example.edu', WRONG);
    assert.equal(err.code, 'INVALID_CREDENTIALS');
    assert.equal(capture.byAction('LOGIN_ACCOUNT_DENIED').length, 0);
  });

  it('an audit write failure never turns a rejected login into a success', async () => {
    const { prisma } = require('../src/config/db');
    const create = prisma.audit_logs.create;
    prisma.audit_logs.create = async () => {
      throw new Error('db down');
    };
    try {
      currentUser = user();
      const err = await attempt('student.one@example.edu', WRONG);
      assert.equal(err?.code, 'INVALID_CREDENTIALS');
      currentUser = user({ status: 'suspended' });
      const denied = await attempt('student.one@example.edu', PASSWORD);
      assert.equal(denied?.code, 'ACCOUNT_DISABLED');
    } finally {
      prisma.audit_logs.create = create;
    }
  });

  it('progressive cooldown starts after the free attempts (same for unknown identifiers)', async () => {
    currentUser = null;
    const free = env.LOGIN_FAILURE_FREE_ATTEMPTS;
    for (let i = 0; i < free - 1; i += 1) await attempt('ghost@example.edu', WRONG);
    assert.equal(loginThrottle.checkLoginAllowed({ ip: IP, identifier: 'ghost@example.edu' }).blocked, false);
    await attempt('ghost@example.edu', WRONG);
    const verdict = loginThrottle.checkLoginAllowed({ ip: IP, identifier: 'ghost@example.edu' });
    assert.equal(verdict.blocked, true);
    assert.equal(verdict.scope, 'ip_identifier');
    assert.ok(verdict.retryAfterSeconds > 0 && verdict.retryAfterSeconds <= env.LOGIN_FAILURE_BASE_COOLDOWN_SECONDS);
    assert.equal(loginThrottle.checkLoginAllowed({ ip: '198.51.100.22', identifier: 'ghost@example.edu' }).blocked, false);
    assert.equal(loginThrottle.checkLoginAllowed({ ip: IP, identifier: 'other@example.edu' }).blocked, false);
  });

  it('a successful login clears the pair cooldown bookkeeping', () => {
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) loginThrottle.noteLoginFailure({ ip: IP, identifier: 'a@example.edu', nowMs: now });
    loginThrottle.noteLoginSuccess({ ip: IP, identifier: 'a@example.edu' });
    const after = loginThrottle.noteLoginFailure({ ip: IP, identifier: 'a@example.edu', nowMs: now });
    assert.equal(after.pairFailures, 1);
  });

  it('cooldown doubles and is capped (no permanent lockout)', () => {
    const base = 30_000;
    const max = 900_000;
    assert.equal(loginThrottle.cooldownMs(4, 5, base, max), 0);
    assert.equal(loginThrottle.cooldownMs(5, 5, base, max), 30_000);
    assert.equal(loginThrottle.cooldownMs(6, 5, base, max), 60_000);
    assert.equal(loginThrottle.cooldownMs(7, 5, base, max), 120_000);
    assert.equal(loginThrottle.cooldownMs(50, 5, base, max), max);
    const t0 = 1_000_000;
    for (let i = 0; i < 40; i += 1) loginThrottle.noteLoginFailure({ ip: IP, identifier: 'z@example.edu', nowMs: t0 });
    const later = loginThrottle.checkLoginAllowed({ ip: IP, identifier: 'z@example.edu', nowMs: t0 + max + 1000 });
    assert.equal(later.blocked, false, 'cooldown always expires');
  });

  it('distributed failures on one account raise LOGIN_BRUTE_FORCE_SUSPECTED once', async () => {
    currentUser = user();
    const threshold = env.LOGIN_FAILURE_ACCOUNT_ALERT_THRESHOLD;
    for (let i = 0; i < threshold + 3; i += 1) {
      await authService
        .login({ email: 'student.one@example.edu', password: WRONG, ipAddress: `198.51.100.${i + 1}` })
        .catch(() => {});
    }
    const rows = capture.byAction('LOGIN_BRUTE_FORCE_SUSPECTED');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].severity, 'HIGH');
    assert.equal(rows[0].subject_user_id, USER_ID);
    assert.ok(rows[0].new_values.distinctIps >= threshold);
    assert.ok(!JSON.stringify(rows[0]).includes('student.one@example.edu'));
  });
});

describe('login throttle guard (HTTP)', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => {
    capture.clear();
    loginThrottle.resetLoginThrottleForTests();
    resetSecurityEventDedupeForTests();
  });

  function app() {
    const a = express();
    a.set('trust proxy', 'loopback');
    a.use(express.json());
    a.post(
      '/login',
      (req, _res, next) => {
        req.validated = req.body;
        next();
      },
      loginThrottleGuard,
      (_req, res) => res.json({ ok: true })
    );
    return a;
  }

  it('returns 429 with Retry-After during cooldown and records one BLOCKED event', async () => {
    const now = Date.now();
    for (let i = 0; i < env.LOGIN_FAILURE_FREE_ATTEMPTS; i += 1) {
      loginThrottle.noteLoginFailure({ ip: IP, identifier: 'victim@example.edu', nowMs: now });
    }
    const a = app();
    const send = () =>
      request(a).post('/login').set('X-Forwarded-For', IP).send({ email: 'Victim@Example.edu', password: WRONG });
    const first = await send();
    const second = await send();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(first.status, 429);
    assert.equal(second.status, 429);
    assert.equal(first.body.code, 'AUTH_RATE_LIMIT');
    assert.ok(Number(first.headers['retry-after']) > 0);
    const rows = capture.byAction('RATE_LIMIT_TRIGGERED');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'BLOCKED');
    assert.equal(rows[0].new_values.limiter, 'login_failure_cooldown');
    assert.ok(!JSON.stringify(rows).includes(WRONG));
    assert.ok(!JSON.stringify(rows).toLowerCase().includes('victim@example.edu'));

    const other = await request(a).post('/login').set('X-Forwarded-For', '198.51.100.22').send({ email: 'victim@example.edu' });
    assert.equal(other.status, 200, 'another client is not locked out');
  });
});
