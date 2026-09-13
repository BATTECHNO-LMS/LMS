const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

test('GET /api/v1/admin/field-training/stats requires authentication', async () => {
  const res = await request(app).get('/api/v1/admin/field-training/stats');
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/admin/field-training/submissions/:id/download-url requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/admin/field-training/submissions/${id}/download-url`);
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/student/field-training/submissions/:id/download-url requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/student/field-training/submissions/${id}/download-url`);
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

test('GET /api/v1/admin/field-training/:id/recorded-lectures requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/admin/field-training/${id}/recorded-lectures`);
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/student/field-training/:id/recorded-lectures requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/student/field-training/${id}/recorded-lectures`);
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/preview requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/preview`)
    .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/import requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/import`)
    .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/playlist/preview requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/playlist/preview`)
    .send({ url: 'https://www.youtube.com/playlist?list=PLtestlist01' });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/playlist/import requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/playlist/import`)
    .send({ url: 'https://www.youtube.com/playlist?list=PLtestlist01', import_all: true });
  assert.strictEqual(res.status, 401);
});

test('PATCH /api/v1/admin/field-training/:id/recorded-lectures/reorder requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .patch(`/api/v1/admin/field-training/${id}/recorded-lectures/reorder`)
    .send({ lecture_ids: [] });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/playlist/sync/preview requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/playlist/sync/preview`)
    .send({ playlist_id: 'PLtestlist01' });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/admin/field-training/:id/recorded-lectures/youtube/playlist/sync requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app)
    .post(`/api/v1/admin/field-training/${id}/recorded-lectures/youtube/playlist/sync`)
    .send({ playlist_id: 'PLtestlist01', import_all: true });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/student/field-training/:id/recorded-lectures/:lectureId/heartbeat requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const lectureId = '00000000-0000-4000-8000-000000000002';
  const res = await request(app)
    .post(`/api/v1/student/field-training/${id}/recorded-lectures/${lectureId}/heartbeat`)
    .send({
      watchSessionId: '00000000-0000-4000-8000-000000000003',
      sequenceNumber: 1,
      fromSecond: 0,
      toSecond: 10,
      currentTime: 10,
      playerState: 'PLAYING',
    });
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/student/field-training/:id/recorded-lectures/:lectureId/watch-session requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const lectureId = '00000000-0000-4000-8000-000000000002';
  const res = await request(app).post(
    `/api/v1/student/field-training/${id}/recorded-lectures/${lectureId}/watch-session`
  );
  assert.strictEqual(res.status, 401);
});

test('GET /api/v1/student/field-training/:id/recorded-lectures/not-a-uuid is unauthenticated first', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).get(`/api/v1/student/field-training/${id}/recorded-lectures/not-a-uuid`);
  assert.strictEqual(res.status, 401);
});

test('POST /api/v1/student/field-training/:id/apply requires authentication', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = await request(app).post(`/api/v1/student/field-training/${id}/apply`).send({});
  assert.strictEqual(res.status, 401);
});
