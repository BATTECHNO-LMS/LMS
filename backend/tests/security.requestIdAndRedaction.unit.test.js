'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const express = require('express');
const request = require('supertest');
const { installAuditCapture } = require('./helpers/auditCapture');
const { requestIdMiddleware, resolveRequestId } = require('../src/middlewares/requestId.middleware');
const { createRequestLogger, PRODUCTION_FORMAT } = require('../src/middlewares/requestLogger.middleware');
const { errorMiddleware } = require('../src/middlewares/error.middleware');
const { recordAudit } = require('../src/shared/services/audit.service');
const { resolveTrustProxyConfig, buildTrustProxyFn } = require('../src/config/trustProxy');
const { redactUrl, sanitizeForLog, redactString, REDACTED } = require('../src/shared/security/redaction');
const { logger } = require('../src/utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Clearly fake, JWT-shaped test values only. */
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJmYWtlLXRlc3QifQ.ZmFrZS1zaWduYXR1cmUtdGVzdA';
const FAKE_PASSWORD = 'Fake#Password-For-Test-1';
const FAKE_OTP = '482913';

function captureStream() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  return { stream, lines };
}

function captureConsole() {
  const out = [];
  const originals = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(originals)) {
    console[k] = (...args) => out.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  }
  return {
    out,
    restore() {
      Object.assign(console, originals);
    },
  };
}

function buildApp({ trust = 'loopback', loggerStream } = {}) {
  const app = express();
  app.set('trust proxy', trust);
  app.use(requestIdMiddleware);
  if (loggerStream) app.use(createRequestLogger({ format: PRODUCTION_FORMAT, stream: loggerStream }));
  app.get('/uploads/file.pdf', (_req, res) => res.json({ ok: true }));
  app.get('/audit', async (req, res) => {
    await recordAudit({ actionType: 'USER_LOGIN_SUCCESS', entityType: 'user', outcome: 'SUCCESS' });
    res.json({ id: req.id });
  });
  app.get('/boom', () => {
    throw new Error(`database exploded token=${FAKE_JWT}`);
  });
  app.use(errorMiddleware);
  return app;
}

describe('request id', () => {
  let capture;
  before(() => {
    capture = installAuditCapture();
  });
  after(() => capture.restore());
  beforeEach(() => capture.clear());

  it('every response carries a server-generated X-Request-Id', async () => {
    const res = await request(buildApp()).get('/uploads/file.pdf');
    assert.match(res.headers['x-request-id'], UUID_RE);
  });

  it('a client-supplied X-Request-Id is ignored by default', async () => {
    const res = await request(buildApp()).get('/uploads/file.pdf').set('X-Request-Id', 'attacker-chosen-id');
    assert.notEqual(res.headers['x-request-id'], 'attacker-chosen-id');
    assert.match(res.headers['x-request-id'], UUID_RE);
  });

  it('an upstream id is accepted only when opted in, from a trusted proxy, in nginx/UUID format', () => {
    const trustFn = buildTrustProxyFn(resolveTrustProxyConfig({ TRUST_PROXY: 'true' }));
    const mkReq = (peer, id) => ({
      headers: { 'x-request-id': id },
      socket: { remoteAddress: peer },
      app: { get: (k) => (k === 'trust proxy fn' ? trustFn : undefined) },
    });
    const nginxId = '0123456789abcdef0123456789abcdef';
    assert.deepEqual(resolveRequestId(mkReq('172.18.0.3', nginxId), { trustUpstream: true }), {
      id: nginxId,
      source: 'upstream',
    });
    assert.equal(resolveRequestId(mkReq('172.18.0.3', nginxId), { trustUpstream: false }).source, 'generated');
    assert.equal(resolveRequestId(mkReq('203.0.113.10', nginxId), { trustUpstream: true }).source, 'generated');
    assert.equal(resolveRequestId(mkReq('172.18.0.3', 'x"; DROP'), { trustUpstream: true }).source, 'generated');
    assert.equal(resolveRequestId(mkReq('172.18.0.3', 'a'.repeat(500)), { trustUpstream: true }).source, 'generated');
  });

  it('access log line, audit row and error log share the same request id', async () => {
    const { stream, lines } = captureStream();
    const app = buildApp({ loggerStream: stream });
    const res = await request(app).get('/audit');
    const id = res.headers['x-request-id'];
    assert.equal(res.body.id, id);
    assert.equal(capture.rows.length, 1);
    assert.equal(capture.rows[0].request_id, id);
    assert.equal(capture.rows[0].security_category, 'AUTHENTICATION');
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(lines.some((l) => l.includes(`rid=${id}`)), lines.join('\n'));

    const con = captureConsole();
    let boom;
    try {
      boom = await request(app).get('/boom');
    } finally {
      con.restore();
    }
    const boomId = boom.headers['x-request-id'];
    assert.equal(boom.status, 500);
    assert.match(boom.body.requestId, /^REQ-[0-9A-F]{12}$/i);
    const errorLine = con.out.find((l) => l.includes('database exploded'));
    assert.ok(errorLine, con.out.join('\n'));
    assert.ok(errorLine.includes(boomId), 'error log carries the canonical request id');
    assert.ok(errorLine.includes(boom.body.requestId), 'and the support code shown to the user');
    assert.ok(!errorLine.includes(FAKE_JWT), 'JWT redacted from error message');
  });

  it('access log redacts query-string credentials', async () => {
    const { stream, lines } = captureStream();
    const app = buildApp({ loggerStream: stream });
    await request(app).get(`/uploads/file.pdf?access_token=${FAKE_JWT}&v=2`);
    await new Promise((r) => setTimeout(r, 10));
    const line = lines.join('\n');
    assert.ok(line.includes(`/uploads/file.pdf?access_token=${REDACTED}&v=2`), line);
    assert.ok(!line.includes(FAKE_JWT));
  });
});

describe('redaction', () => {
  it('redactUrl removes sensitive query values but keeps the path and harmless params', () => {
    assert.equal(redactUrl('/a/b?page=2'), '/a/b?page=2');
    assert.equal(redactUrl(`/x?token=${FAKE_JWT}&page=1`), `/x?token=${REDACTED}&page=1`);
    assert.equal(redactUrl(`/x?Password=${FAKE_PASSWORD}`), `/x?Password=${REDACTED}`);
    assert.equal(redactUrl(`/x?otp=${FAKE_OTP}&email=a%40b.c`), `/x?otp=${REDACTED}&email=${REDACTED}`);
    assert.equal(redactUrl('/x?X-Amz-Signature=abc'), `/x?X-Amz-Signature=${REDACTED}`);
    assert.ok(!redactUrl(`/x/${FAKE_JWT}/y`).includes(FAKE_JWT));
  });

  it('sanitizeForLog drops secret-bearing keys at any depth and bounds sizes', () => {
    const out = sanitizeForLog({
      password: FAKE_PASSWORD,
      nested: { refreshToken: 'r', otpCode: FAKE_OTP, cookie: 'sid=1', ok: 'visible' },
      headers: { authorization: `Bearer ${FAKE_JWT}` },
      note: `Bearer ${FAKE_JWT}`,
      identifierHash: 'abc123',
      big: 'x'.repeat(5000),
    });
    const text = JSON.stringify(out);
    for (const secret of [FAKE_PASSWORD, FAKE_JWT, FAKE_OTP, 'sid=1']) assert.ok(!text.includes(secret), secret);
    assert.equal(out.nested.ok, 'visible');
    assert.equal(out.identifierHash, 'abc123', 'one-way fingerprints are kept');
    assert.ok(out.big.length <= 2001);
  });

  it('redactString strips bearer credentials and JWTs inside free text', () => {
    const s = redactString(`Authorization: Bearer ${FAKE_JWT} then raw ${FAKE_JWT}`);
    assert.ok(!s.includes(FAKE_JWT));
  });

  it('the structured logger never prints secrets passed as metadata', () => {
    const con = captureConsole();
    try {
      logger.warn(`login failed for Bearer ${FAKE_JWT}`, { password: FAKE_PASSWORD, otp: FAKE_OTP, token: FAKE_JWT });
    } finally {
      con.restore();
    }
    const text = con.out.join('\n');
    for (const secret of [FAKE_PASSWORD, FAKE_JWT, FAKE_OTP]) assert.ok(!text.includes(secret), secret);
  });
});
