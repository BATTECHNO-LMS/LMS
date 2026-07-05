const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

const fakeSubmissionId = '00000000-0000-4000-8000-000000000001';

test('PUT /api/v1/submissions/:id requires authentication', async () => {
  const res = await request(app)
    .put(`/api/v1/submissions/${fakeSubmissionId}`)
    .send({ submission_type: 'text_response', text_response: 'test' });

  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/dashboard/admin-stats requires authentication', async () => {
  const res = await request(app).get('/api/v1/dashboard/admin-stats');
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/roles requires authentication', async () => {
  const res = await request(app).get('/api/v1/roles');
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/analytics/export/pdf requires authentication', async () => {
  const res = await request(app).get('/api/v1/analytics/export/pdf');
  assert.strictEqual(res.status, 401);
});
