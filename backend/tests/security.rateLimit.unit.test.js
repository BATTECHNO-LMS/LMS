'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { installAuditCapture } = require('./helpers/auditCapture');
const { resolveTrustProxyConfig, buildTrustProxyFn } = require('../src/config/trustProxy');
const {
  createRateLimiter,
  userOrIpKey,
  credentialAttemptKey,
  CREDENTIAL_LIMIT_MESSAGE,
} = require('../src/middlewares/rateLimit.middleware');
const { signToken } = require('../src/utils/jwt');
const { resetSecurityEventDedupeForTests } = require('../src/shared/security/securityEvents');
const { requestIdMiddleware } = require('../src/middlewares/requestId.middleware');

const GATEWAY = '172.18.0.1';
const CLIENT_A = '203.0.113.10';
const CLIENT_B = '198.51.100.22';
const flush = () => new Promise((r) => setTimeout(r, 30));

let limiterSeq = 0;
function buildApp({ max = 2, keyGenerator = userOrIpKey, withIdentifier = false, message } = {}) {
  limiterSeq += 1;
  const app = express();
  app.set('trust proxy', buildTrustProxyFn(resolveTrustProxyConfig({ TRUST_PROXY: 'true' })));
  app.use(express.json());
  app.use(requestIdMiddleware);
  const limiter = createRateLimiter({
    name: `test_limiter_${limiterSeq}`,
    routeGroup: 'test',
    windowMs: 60_000,
    max,
    keyGenerator,
    keyType: withIdentifier ? 'ip_identifier' : 'user_or_ip',
    withIdentifier,
    message: message || { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
  });
  app.all('/limited', limiter, (req, res) => res.json({ ok: true }));
  return app;
}

const from = (agent, client, spoof) =>
  agent.set('X-Forwarded-For', spoof ? `${spoof}, ${client}, ${GATEWAY}` : `${client}, ${GATEWAY}`);

describe('rate limiter identity', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => {
    capture.clear();
    resetSecurityEventDedupeForTests();
  });

  it('client A exhausting its bucket does not block client B (no shared gateway bucket)', async () => {
    const app = buildApp({ max: 2 });
    for (let i = 0; i < 2; i += 1) assert.equal((await from(request(app).get('/limited'), CLIENT_A)).status, 200);
    assert.equal((await from(request(app).get('/limited'), CLIENT_A)).status, 429);
    assert.equal((await from(request(app).get('/limited'), CLIENT_B)).status, 200);
  });

  it('spoofing X-Forwarded-For does not create a fresh bucket', async () => {
    const app = buildApp({ max: 1 });
    assert.equal((await from(request(app).get('/limited'), CLIENT_A)).status, 200);
    for (const spoof of ['1.1.1.1', '8.8.8.8', '10.9.9.9', 'garbage']) {
      const res = await from(request(app).get('/limited'), CLIENT_A, spoof);
      assert.equal(res.status, 429, `spoof ${spoof} must not evade`);
    }
  });

  it('a forged Bearer token cannot mint per-user buckets (falls back to IP)', async () => {
    const app = buildApp({ max: 1 });
    assert.equal((await from(request(app).get('/limited'), CLIENT_A)).status, 200);
    const res = await from(request(app).get('/limited'), CLIENT_A).set('Authorization', 'Bearer forged.jwt.value');
    assert.equal(res.status, 429);
  });

  it('two signed-in users behind one NAT get separate buckets', async () => {
    const app = buildApp({ max: 1 });
    const t1 = signToken({ userId: '11111111-1111-4111-8111-111111111111' });
    const t2 = signToken({ userId: '22222222-2222-4222-8222-222222222222' });
    assert.equal((await from(request(app).get('/limited'), CLIENT_A).set('Authorization', `Bearer ${t1}`)).status, 200);
    assert.equal((await from(request(app).get('/limited'), CLIENT_A).set('Authorization', `Bearer ${t1}`)).status, 429);
    assert.equal((await from(request(app).get('/limited'), CLIENT_A).set('Authorization', `Bearer ${t2}`)).status, 200);
  });

  it('credential limiter: per client IP + normalized identifier', async () => {
    const app = buildApp({ max: 1, keyGenerator: credentialAttemptKey, withIdentifier: true, message: CREDENTIAL_LIMIT_MESSAGE });
    const post = (client, email) => from(request(app).post('/limited'), client).send({ email, password: 'x' });
    assert.equal((await post(CLIENT_A, 'victim@example.com')).status, 200);
    assert.equal((await post(CLIENT_A, '  VICTIM@example.com ')).status, 429, 'case/whitespace normalized');
    assert.equal((await post(CLIENT_A, 'other@example.com')).status, 200, 'other identifier, same client');
    assert.equal((await post(CLIENT_B, 'victim@example.com')).status, 200, 'same identifier, other client');
  });
});

describe('RATE_LIMIT_TRIGGERED security event', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => {
    capture.clear();
    resetSecurityEventDedupeForTests();
  });

  it('429 records exactly one event per bucket per window, with request correlation', async () => {
    const app = buildApp({ max: 1 });
    await from(request(app).get('/limited'), CLIENT_A);
    const blocked = [];
    for (let i = 0; i < 4; i += 1) blocked.push(await from(request(app).get('/limited'), CLIENT_A));
    await flush();
    assert.ok(blocked.every((r) => r.status === 429));
    assert.equal(blocked[0].body.code, 'RATE_LIMIT');
    const rows = capture.byAction('RATE_LIMIT_TRIGGERED');
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.outcome, 'BLOCKED');
    assert.equal(row.security_category, 'RATE_LIMIT');
    assert.equal(row.severity, 'WARNING');
    assert.equal(row.ip_address, CLIENT_A);
    assert.equal(row.request_id, blocked[0].headers['x-request-id']);
    assert.equal(row.new_values.routeGroup, 'test');
    assert.equal(row.new_values.keyType, 'user_or_ip');
  });

  it('a second client produces its own (single) event', async () => {
    const app = buildApp({ max: 1 });
    for (const client of [CLIENT_A, CLIENT_B]) {
      await from(request(app).get('/limited'), client);
      await from(request(app).get('/limited'), client);
      await from(request(app).get('/limited'), client);
    }
    await flush();
    const ips = capture.byAction('RATE_LIMIT_TRIGGERED').map((r) => r.ip_address).sort();
    assert.deepEqual(ips, [CLIENT_B, CLIENT_A].sort());
  });

  it('credential limiter event stores an identifier fingerprint, never the email or password', async () => {
    const app = buildApp({ max: 1, keyGenerator: credentialAttemptKey, withIdentifier: true, message: CREDENTIAL_LIMIT_MESSAGE });
    const body = { email: 'victim@example.com', password: 'Sup3r-Secret-Pass!' };
    await from(request(app).post('/limited'), CLIENT_A).send(body);
    const res = await from(request(app).post('/limited'), CLIENT_A).send(body);
    await flush();
    assert.equal(res.status, 429);
    assert.equal(res.body.code, 'AUTH_RATE_LIMIT');
    const rows = capture.byAction('RATE_LIMIT_TRIGGERED');
    assert.equal(rows.length, 1);
    assert.match(rows[0].new_values.identifierHash, /^[0-9a-f]{24}$/);
    const serialized = JSON.stringify(rows);
    assert.ok(!serialized.includes('victim@example.com'));
    assert.ok(!serialized.includes('Sup3r-Secret-Pass!'));
  });

  it('the 429 is still returned when the event write fails', async () => {
    const { prisma } = require('../src/config/db');
    const app = buildApp({ max: 1 });
    const create = prisma.audit_logs.create;
    prisma.audit_logs.create = async () => {
      throw new Error('db down');
    };
    try {
      await from(request(app).get('/limited'), CLIENT_A);
      const res = await from(request(app).get('/limited'), CLIENT_A);
      await flush();
      assert.equal(res.status, 429);
    } finally {
      prisma.audit_logs.create = create;
    }
  });
});
