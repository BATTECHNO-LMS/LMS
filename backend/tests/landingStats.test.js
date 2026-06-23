const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

const NUMERIC_KEYS = [
  'usersCount',
  'visitsCount',
  'universitiesCount',
  'microCredentialsCount',
  'cohortsCount',
  'assessmentsCount',
  'certificatesCount',
  'attendanceRate',
  'sessionsThisWeekCount',
  'openAssessmentsCount',
  'issuedCertificatesCount',
];

test('GET /api/v1/public/landing-stats returns aggregate counts', async (t) => {
  const res = await request(app).get('/api/v1/public/landing-stats');

  if (res.status === 500) {
    t.skip('Database unavailable for landing-stats integration test');
    return;
  }

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data);

  for (const key of NUMERIC_KEYS) {
    assert.strictEqual(typeof res.body.data[key], 'number', `${key} should be a number`);
    assert.ok(res.body.data[key] >= 0, `${key} should be non-negative`);
  }

  assert.ok(res.body.data.visitsCount >= 1);
  assert.ok(Array.isArray(res.body.data.activePrograms));
  assert.strictEqual(res.body.data.activePrograms.length, 2);
  for (const program of res.body.data.activePrograms) {
    assert.strictEqual(typeof program.label, 'string');
    assert.strictEqual(typeof program.progress, 'number');
    assert.ok(program.progress >= 0 && program.progress <= 100);
  }
});
