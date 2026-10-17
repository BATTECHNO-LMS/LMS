'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { installAuditCapture } = require('./helpers/auditCapture');
const { requestIdMiddleware } = require('../src/middlewares/requestId.middleware');
const { errorMiddleware } = require('../src/middlewares/error.middleware');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { assertUniversityRecordAccess, resolveUniversityIdFilter } = require('../src/utils/universityScope');
const { ApiError } = require('../src/utils/apiError');
const {
  classifyForbiddenError,
  resetSecurityEventDedupeForTests,
} = require('../src/shared/security/securityEvents');
const { recordOtpFailure, recordOtpRateLimited } = require('../src/modules/auth/otpSecurityEvents');
const auditLogsService = require('../src/modules/audit-logs/auditLogs.service');
const { listAuditLogsQuerySchema } = require('../src/modules/audit-logs/auditLogs.validation');

const UNI_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNI_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ADMIN_A = '44444444-4444-4444-8444-444444444444';
const STUDENT = '55555555-5555-4555-8555-555555555555';

const USERS = {
  adminA: { userId: ADMIN_A, roles: ['admin'], universityId: UNI_A, organizationId: ORG_A, isGlobal: false },
  student: { userId: STUDENT, roles: ['student'], universityId: UNI_A, isGlobal: false },
  superAdmin: { userId: '66666666-6666-4666-8666-666666666666', roles: ['super_admin'], isGlobal: true },
};

const flush = () => new Promise((r) => setTimeout(r, 30));

function buildApp() {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(requestIdMiddleware);
  app.use((req, _res, next) => {
    const who = req.headers['x-test-user'];
    if (who && USERS[who]) req.user = { ...USERS[who] };
    next();
  });
  app.get('/admin-only', authorizeRoles('super_admin'), (_req, res) => res.json({ ok: true }));
  app.get('/universities/:universityId/reports', (req, _res, next) => {
    try {
      assertUniversityRecordAccess(req.user, req.params.universityId);
      return _res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });
  app.get('/reports', (req, res, next) => {
    try {
      res.json({ universityId: resolveUniversityIdFilter(req.user, req.query.university_id) });
    } catch (err) {
      next(err);
    }
  });
  app.post('/tasks/:id/submit', (_req, _res, next) => next(new ApiError(403, 'Task is locked', null, 'TASK_LOCKED')));
  app.use(errorMiddleware);
  return app;
}

describe('authorization denial events', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => {
    capture.clear();
    resetSecurityEventDedupeForTests();
  });

  it('cross-university record access → 403 + exactly one CROSS_SCOPE_ACCESS_DENIED (HIGH)', async () => {
    const res = await request(buildApp())
      .get(`/universities/${UNI_B}/reports`)
      .set('X-Test-User', 'adminA')
      .set('X-Forwarded-For', '203.0.113.10');
    await flush();
    assert.equal(res.status, 403);
    const rows = capture.byAction('CROSS_SCOPE_ACCESS_DENIED');
    assert.equal(rows.length, 1);
    assert.equal(capture.byAction('AUTHORIZATION_DENIED').length, 0);
    const row = rows[0];
    assert.equal(row.outcome, 'DENIED');
    assert.equal(row.security_category, 'AUTHORIZATION');
    assert.equal(row.severity, 'HIGH');
    assert.equal(row.user_id, ADMIN_A);
    assert.equal(row.ip_address, '203.0.113.10');
    assert.equal(row.request_id, res.headers['x-request-id']);
    assert.equal(row.new_values.scopeType, 'university');
    assert.equal(row.new_values.route, '/universities/:universityId/reports');
    assert.equal(row.new_values.actorUniversityId, UNI_A);
    assert.ok(!JSON.stringify(row).includes(UNI_B), 'target id is not echoed into metadata');
  });

  it('cross-university list filter is classified the same way', async () => {
    const res = await request(buildApp()).get(`/reports?university_id=${UNI_B}`).set('X-Test-User', 'adminA');
    await flush();
    assert.equal(res.status, 403);
    assert.equal(capture.byAction('CROSS_SCOPE_ACCESS_DENIED').length, 1);
  });

  it('repeated identical denials are deduplicated (response unchanged)', async () => {
    const app = buildApp();
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await request(app).get(`/universities/${UNI_B}/reports`).set('X-Test-User', 'adminA')).status);
    }
    await flush();
    assert.deepEqual(statuses, [403, 403, 403, 403, 403]);
    assert.equal(capture.byAction('CROSS_SCOPE_ACCESS_DENIED').length, 1);
  });

  it('role-gated route → AUTHORIZATION_DENIED once (middleware owns it, error middleware does not repeat)', async () => {
    const res = await request(buildApp()).get('/admin-only').set('X-Test-User', 'student');
    await flush();
    assert.equal(res.status, 403);
    const rows = capture.byAction('AUTHORIZATION_DENIED');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].severity, 'WARNING');
    assert.equal(rows[0].new_values.reason, 'ROLE_NOT_ALLOWED');
    assert.deepEqual(rows[0].new_values.requiredRoles, ['super_admin']);
  });

  it('super admin passes; business-rule 403s and anonymous requests are not security events', async () => {
    const app = buildApp();
    assert.equal((await request(app).get('/admin-only').set('X-Test-User', 'superAdmin')).status, 200);
    assert.equal((await request(app).get(`/universities/${UNI_B}/reports`).set('X-Test-User', 'superAdmin')).status, 200);
    assert.equal((await request(app).post('/tasks/1/submit').set('X-Test-User', 'student')).status, 403);
    assert.equal((await request(app).get('/admin-only')).status, 401);
    await flush();
    assert.equal(capture.rows.length, 0);
  });

  it('classifyForbiddenError separates access control from business 403s', () => {
    assert.equal(classifyForbiddenError(new ApiError(403, 'x', null, 'TASK_LOCKED')), null);
    assert.equal(classifyForbiddenError(new ApiError(404, 'x')), null);
    assert.equal(classifyForbiddenError(new ApiError(403, 'x')).eventType, 'AUTHORIZATION_DENIED');
    assert.equal(
      classifyForbiddenError(new ApiError(403, 'x', null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN')).eventType,
      'CROSS_SCOPE_ACCESS_DENIED'
    );
  });
});

describe('OTP security events', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => {
    capture.clear();
    resetSecurityEventDedupeForTests();
  });

  it('wrong code → OTP_FAILED; last attempt also → OTP_LOCKED_TEMPORARILY; no code stored', async () => {
    const base = { userId: STUDENT, otpId: '77777777-7777-4777-8777-777777777777', purpose: 'PASSWORD_RESET', maxAttempts: 5 };
    await recordOtpFailure({ ...base, attemptsUsed: 4 });
    assert.equal(capture.byAction('OTP_FAILED').length, 1);
    assert.equal(capture.byAction('OTP_LOCKED_TEMPORARILY').length, 0);
    await recordOtpFailure({ ...base, attemptsUsed: 5 });
    const locked = capture.byAction('OTP_LOCKED_TEMPORARILY');
    assert.equal(locked.length, 1);
    assert.equal(locked[0].outcome, 'BLOCKED');
    assert.equal(locked[0].security_category, 'ACCOUNT_SECURITY');
    assert.equal(locked[0].subject_user_id, STUDENT);
    await recordOtpRateLimited(base);
    await recordOtpRateLimited(base);
    assert.equal(capture.byAction('OTP_RATE_LIMITED').length, 1, 'deduplicated per OTP');
    for (const row of capture.rows) {
      assert.deepEqual(Object.keys(row.new_values).sort().filter((k) => /otp|code|token/i.test(k)), []);
    }
  });
});

describe('security event registry and migration', () => {
  const {
    AUDIT_ACTIONS,
    SECURITY_CATEGORIES,
    SECURITY_SEVERITIES,
    AUDIT_OUTCOMES,
    securityMetaForAction,
  } = require('../src/shared/audit/auditActions');

  it('required Phase 1A events are registered with category and severity', () => {
    const expected = {
      USER_LOGIN_FAILED: 'AUTHENTICATION',
      LOGIN_ACCOUNT_DENIED: 'AUTHENTICATION',
      LOGIN_BRUTE_FORCE_SUSPECTED: 'AUTHENTICATION',
      AUTHORIZATION_DENIED: 'AUTHORIZATION',
      CROSS_SCOPE_ACCESS_DENIED: 'AUTHORIZATION',
      RATE_LIMIT_TRIGGERED: 'RATE_LIMIT',
      OTP_FAILED: 'ACCOUNT_SECURITY',
      OTP_LOCKED_TEMPORARILY: 'ACCOUNT_SECURITY',
      OTP_RATE_LIMITED: 'RATE_LIMIT',
      TOKEN_INVALID: 'AUTHENTICATION',
    };
    for (const [action, category] of Object.entries(expected)) {
      assert.equal(securityMetaForAction(action)?.category, category, action);
    }
    assert.equal(AUDIT_OUTCOMES.BLOCKED, 'BLOCKED');
  });

  it('every security-tagged action uses a known category and severity', () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      const meta = securityMetaForAction(action);
      if (!meta) continue;
      assert.ok(SECURITY_CATEGORIES[meta.category], `${action} category`);
      assert.ok(SECURITY_SEVERITIES[meta.severity], `${action} severity`);
    }
  });

  it('the security migration is additive only', () => {
    const fs = require('fs');
    const path = require('path');
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'prisma', 'migrations', '20261015120000_audit_logs_security_events', 'migration.sql'),
      'utf8'
    );
    assert.ok(/ADD COLUMN IF NOT EXISTS "security_category"/.test(sql));
    assert.ok(/ADD COLUMN IF NOT EXISTS "severity"/.test(sql));
    assert.ok(!/\b(DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, '')));
  });
});

describe('activity log security filters (RBAC)', () => {
  const superAdmin = { userId: 'sa', roles: ['super_admin'], isGlobal: true };
  const uniAdminA = {
    userId: 'ua',
    roles: ['admin'],
    universityId: UNI_A,
    organizationId: ORG_A,
    isGlobal: false,
    scope: { universityId: UNI_A, organizationId: ORG_A },
  };

  it('validates the new query parameters', () => {
    const ok = listAuditLogsQuerySchema.safeParse({
      security_category: 'RATE_LIMIT',
      severity: 'HIGH',
      outcome: 'BLOCKED',
      security_only: 'true',
      ip_address: '2001:db8::1',
      request_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    });
    assert.equal(ok.success, true, JSON.stringify(ok.error?.issues));
    assert.equal(listAuditLogsQuerySchema.safeParse({ severity: 'URGENT' }).success, false);
    assert.equal(listAuditLogsQuerySchema.safeParse({ security_category: 'MAGIC' }).success, false);
    assert.equal(listAuditLogsQuerySchema.safeParse({ ip_address: '999.1.1.1' }).success, false);
    assert.equal(listAuditLogsQuerySchema.safeParse({ request_id: "x' OR 1=1 --" }).success, false);
  });

  it('super admin may filter by category, severity, IP and request id', async () => {
    const where = await auditLogsService.buildListWhere(
      { security_category: 'AUTHORIZATION', severity: 'HIGH', ip_address: '203.0.113.10', request_id: 'abc' },
      superAdmin
    );
    const text = JSON.stringify(where);
    assert.ok(text.includes('"security_category":"AUTHORIZATION"'));
    assert.ok(text.includes('CROSS_SCOPE_ACCESS_DENIED'), 'legacy rows matched through the registry');
    assert.ok(text.includes('"ip_address":"203.0.113.10"'));
    assert.ok(text.includes('"request_id":"abc"'));
  });

  it('scoped admin keeps the tenant restriction and cannot use technical filters', async () => {
    const where = await auditLogsService.buildListWhere({ security_category: 'AUTHENTICATION' }, uniAdminA);
    assert.deepEqual(where.AND[0], { OR: [{ university_id: UNI_A }, { university_id: null, organization_id: ORG_A }] });
    await assert.rejects(
      auditLogsService.buildListWhere({ ip_address: '203.0.113.10' }, uniAdminA),
      (err) => err.statusCode === 403 && err.code === 'AUDIT_FILTER_GLOBAL_ONLY'
    );
    await assert.rejects(
      auditLogsService.buildListWhere({ request_id: 'abc' }, uniAdminA),
      (err) => err.code === 'AUDIT_FILTER_GLOBAL_ONLY'
    );
  });

  it('students see nothing, whatever filters they send', async () => {
    const where = await auditLogsService.buildListWhere({ security_only: true }, { userId: 's', roles: ['student'] });
    assert.deepEqual(where, { id: { in: [] } });
  });
});
