const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

test('GET /api/v1/admin/field-training/stats requires authentication', async () => {
  const res = await request(app).get('/api/v1/admin/field-training/stats');
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/admin/field-training/submissions/:id/download requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/admin/field-training/submissions/${id}/download`);
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/student/field-training/submissions/:id/download requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/student/field-training/submissions/${id}/download`);
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/analytics/field-training requires authentication', async () => {
  const res = await request(app).get('/api/v1/analytics/field-training');
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/student/field-training requires authentication', async () => {
  const res = await request(app).get('/api/v1/student/field-training');
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/student/field-training/:id/apply requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).post(`/api/v1/student/field-training/${id}/apply`).send({});
  assert.strictEqual(res.status, 401);
});
