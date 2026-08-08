const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

test('GET / returns 200', async () => {
  const res = await request(app).get('/');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.status, 'running');
});

test('GET /health returns 200', async () => {
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.service, 'battechno-lms-api');
});

test('GET /health/ready returns 503 when DATABASE_URL is not configured', async (t) => {
  const { env } = require('../src/config/env');
  // Unit CI has no DATABASE_URL. If a local .env sets one, skip to avoid remote DB pings.
  if (env.DATABASE_URL) {
    t.skip('DATABASE_URL is set in this environment; readiness connectivity is covered by /health/ready in deploy checks');
    return;
  }
  const res = await request(app).get('/health/ready');
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.body.status, 'not_ready');
  assert.strictEqual(res.body.db, false);
});

test('CORS preflight allows production frontend for /api/auth/login', async () => {
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://lms.battechno.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type, authorization, x-requested-with');

  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'https://lms.battechno.com');
  assert.match(res.headers['access-control-allow-methods'], /POST/);
  assert.ok(res.headers['access-control-allow-credentials']);
});

test('CORS preflight allows www production frontend', async () => {
  const res = await request(app)
    .options('/api/auth/me')
    .set('Origin', 'https://www.lms.battechno.com')
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'authorization');

  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'https://www.lms.battechno.com');
});

test('CORS rejects unknown origins', async () => {
  const res = await request(app)
    .get('/health')
    .set('Origin', 'https://evil.example.com');

  assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://evil.example.com');
});
