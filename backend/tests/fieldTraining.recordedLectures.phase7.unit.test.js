'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../src/utils/apiError');
const { createService } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.service');
const lectureMappers = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');
const { assertReorderPayload } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');
const {
  createWatchService,
  PLAYER_STATES,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.watch.service');
const {
  heartbeatBodySchema,
  createRecordedLectureBodySchema,
  updateRecordedLectureBodySchema,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.validation');
const { parseYoutubeVideoInput, parseYoutubePlaylistInput } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeUrls');
const { uniqueWatchedSeconds, mergeIntervals } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.intervals');

const ROOT = path.join(__dirname, '..');
const ZARQA_UNI = '4b85f423-c543-499e-9765-a5248dbfa583';
const TAFILA_UNI = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZARQA_OPP = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const VIDEO_ID = 'dQw4w9WgXcQ';
const STUDENT_ZARQA = '33333333-3333-4333-8333-333333333333';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function user({ roles, universityId, isGlobal = false, organizationType = 'UNIVERSITY', userId }) {
  return {
    userId: userId || crypto.randomUUID(),
    roles,
    universityId,
    isGlobal,
    organizationType,
    portalType: organizationType,
  };
}

function makeLectureStore() {
  return {
    opportunities: [
      { id: ZARQA_OPP, title: 'Zarqa FT', university_id: ZARQA_UNI, assigned_instructor_id: null, status: 'published' },
      { id: TAFILA_OPP, title: 'Tafila FT', university_id: TAFILA_UNI, assigned_instructor_id: null, status: 'published' },
    ],
    sessions: [],
    applications: [
      {
        id: crypto.randomUUID(),
        opportunity_id: ZARQA_OPP,
        student_id: STUDENT_ZARQA,
        status: 'approved',
        training_status: 'in_training',
        expelled_at: null,
      },
    ],
    lectures: [],
  };
}

function createLectureHarness(store = makeLectureStore()) {
  const lectureRepo = {
    mapLectureRow: lectureMappers.mapLectureRow,
    mapStudentLectureRow: lectureMappers.mapStudentLectureRow,
    async listByOpportunity(opportunityId, { status } = {}) {
      return store.lectures.filter(
        (row) => row.opportunity_id === opportunityId && (!status || row.status === status)
      );
    },
    async findById(id) {
      return store.lectures.find((item) => item.id === id) || null;
    },
    async findMaxSortOrder() {
      return null;
    },
    async createLecture(data) {
      const row = { id: crypto.randomUUID(), created_at: new Date(), updated_at: new Date(), ...data };
      store.lectures.push(row);
      return row;
    },
    async updateLecture(id, data) {
      const idx = store.lectures.findIndex((row) => row.id === id);
      store.lectures[idx] = { ...store.lectures[idx], ...data };
      return store.lectures[idx];
    },
  };
  const ftRepo = {
    async findById(id) {
      return store.opportunities.find((row) => row.id === id) || null;
    },
    async findPublishedById(id) {
      return store.opportunities.find((row) => row.id === id) || null;
    },
    async findSessionById() {
      return null;
    },
    async findApplicationByOpportunityAndStudent(opportunityId, studentId) {
      return (
        store.applications.find(
          (row) => row.opportunity_id === opportunityId && row.student_id === studentId
        ) || null
      );
    },
  };
  return {
    store,
    service: createService({
      lectureRepo,
      ftRepo,
      recordAudit: async () => {},
      watchService: {
        async attachStudentProgress(_app, rows) {
          return rows.map((row) => ({ ...lectureMappers.mapStudentLectureRow(row), progress: null }));
        },
        async getProgress() {
          return { progress: null };
        },
      },
      assertStudentCanAccessOpportunity: async () => {},
    }),
  };
}

function makeWatchHarness({ duration = 3600, status = 'published', opportunityId = ZARQA_OPP } = {}) {
  const lectureId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const store = {
    lectures: [
      {
        id: lectureId,
        opportunity_id: opportunityId,
        status,
        duration_seconds: duration,
        provider: 'youtube',
        provider_video_id: VIDEO_ID,
        title: '<script>alert(1)</script>',
      },
    ],
    applications: [
      {
        id: applicationId,
        opportunity_id: ZARQA_OPP,
        student_id: STUDENT_ZARQA,
        status: 'approved',
        training_status: 'in_training',
        expelled_at: null,
      },
    ],
    progress: [],
    queries: [],
  };
  const watchRepo = {
    async findPublishedLecture(id) {
      return store.lectures.find((row) => row.id === id) || null;
    },
    async findApprovedApplication(oppId, studentId) {
      return store.applications.find((row) => row.opportunity_id === oppId && row.student_id === studentId) || null;
    },
    async listProgressByApplicationAndLectureIds(appId, lectureIds) {
      return store.progress.filter((row) => row.application_id === appId && lectureIds.includes(row.lecture_id));
    },
    async ensureProgress({ lectureId: lecId, applicationId: appId, studentId, videoDurationSeconds }) {
      let row = store.progress.find((item) => item.lecture_id === lecId && item.application_id === appId);
      if (!row) {
        row = {
          id: crypto.randomUUID(),
          lecture_id: lecId,
          application_id: appId,
          student_id: studentId,
          video_duration_seconds: videoDurationSeconds,
          unique_watched_seconds: 0,
          total_playback_seconds: 0,
          last_position_seconds: 0,
          progress_percentage: null,
          started_at: null,
          last_watched_at: null,
          completed_at: null,
          heartbeat_cursors: {},
          segments: [],
        };
        store.progress.push(row);
      }
      return { ...row, segments: [...(row.segments || [])] };
    },
    async applyHeartbeatTransaction({ progressId, next, segments, duplicate }) {
      const row = store.progress.find((item) => item.id === progressId);
      if (!duplicate) {
        Object.assign(row, next);
        row.segments = (segments || []).map(([start, end]) => ({ start_second: start, end_second: end }));
      }
      return { ...row, segments: [...(row.segments || [])] };
    },
  };
  return {
    lectureId,
    store,
    service: createWatchService({ watchRepo, queryCounter: store.queries }),
  };
}

async function play(service, { lectureId, session, seq, from, to, state = PLAYER_STATES.PLAYING, extra = {} }) {
  return service.processHeartbeat(ZARQA_OPP, lectureId, STUDENT_ZARQA, {
    watchSessionId: session,
    sequenceNumber: seq,
    fromSecond: from,
    toSecond: to,
    currentTime: to,
    playerState: state,
    ...extra,
  });
}

async function playRange(service, opts) {
  const { from, to, startSeq = 1, step = 10 } = opts;
  let seq = startSeq;
  let cursor = from;
  let last = null;
  while (cursor < to) {
    const next = Math.min(to, cursor + step);
    last = await play(service, { ...opts, seq, from: cursor, to: next });
    seq += 1;
    cursor = next;
  }
  return { last, nextSeq: seq };
}

describe('Phase 7 recorded lectures authorization matrix', () => {
  it('allows university admin on own opportunity and denies the other university', async () => {
    const { service } = createLectureHarness();
    const zarqaAdmin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const listed = await service.listForStaff(ZARQA_OPP, zarqaAdmin);
    assert.equal(listed.lectures.length, 0);
    await assert.rejects(
      () => service.listForStaff(TAFILA_OPP, zarqaAdmin),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies reviewer mutation, trainer, trainee, institution, and unscoped admin', async () => {
    const { service } = createLectureHarness();
    const payload = { title: 'React', provider: 'YOUTUBE', provider_video_id: VIDEO_ID };
    const denied = [
      user({ roles: ['reviewer'], universityId: ZARQA_UNI }),
      user({ roles: ['trainer'], universityId: ZARQA_UNI }),
      user({ roles: ['trainee'], universityId: ZARQA_UNI }),
      user({ roles: ['admin'], universityId: ZARQA_UNI, organizationType: 'INSTITUTION' }),
      user({ roles: ['admin'], universityId: null }),
      user({ roles: ['student'], universityId: ZARQA_UNI }),
    ];
    for (const actor of denied) {
      await assert.rejects(
        () => service.createForOpportunity(ZARQA_OPP, payload, actor),
        (err) => err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 401)
      );
    }
  });

  it('lets super_admin manage without a university assignment and does not grant global access to unscoped admin', async () => {
    const { service } = createLectureHarness();
    const superAdmin = user({ roles: ['super_admin'], isGlobal: true, universityId: null });
    const created = await service.createForOpportunity(
      TAFILA_OPP,
      { title: 'Safe', provider: 'YOUTUBE', provider_video_id: VIDEO_ID },
      superAdmin
    );
    assert.equal(created.lecture.opportunity_id, TAFILA_OPP);
    const unscoped = user({ roles: ['admin'], universityId: null, isGlobal: false });
    await assert.rejects(
      () => service.listForStaff(ZARQA_OPP, unscoped),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

describe('Phase 7 mass assignment, XSS text, and destructive delete', () => {
  it('ignores forged creator, opportunity, and progress fields on create/update schemas', () => {
    const created = createRecordedLectureBodySchema.parse({
      title: '<script>alert(1)</script>',
      provider: 'YOUTUBE',
      provider_video_id: VIDEO_ID,
      created_by_id: crypto.randomUUID(),
      createdBy: crypto.randomUUID(),
      opportunityId: TAFILA_OPP,
      uniqueWatchedSeconds: 99999,
      progressPercentage: 100,
      completedAt: new Date().toISOString(),
      studentId: STUDENT_ZARQA,
    });
    assert.equal(created.title, '<script>alert(1)</script>');
    assert.equal(created.created_by_id, undefined);
    assert.equal(created.opportunityId, undefined);
    assert.equal(created.uniqueWatchedSeconds, undefined);
    assert.equal(created.completedAt, undefined);

    const updated = updateRecordedLectureBodySchema.parse({
      title: 'ok',
      uniqueWatchedSeconds: 12,
      completedAt: 'now',
      studentId: STUDENT_ZARQA,
    });
    assert.equal(updated.uniqueWatchedSeconds, undefined);
    assert.equal(updated.studentId, undefined);
  });

  it('uses the authenticated user as created_by and path opportunity, not body values', async () => {
    const { service, store } = createLectureHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const forgedCreator = crypto.randomUUID();
    const result = await service.createForOpportunity(
      ZARQA_OPP,
      {
        title: '<script>alert(1)</script>',
        provider: 'YOUTUBE',
        provider_video_id: VIDEO_ID,
        created_by_id: forgedCreator,
        opportunity_id: TAFILA_OPP,
        unique_watched_seconds: 99999,
      },
      admin
    );
    assert.equal(result.lecture.created_by_id, admin.userId);
    assert.notEqual(result.lecture.created_by_id, forgedCreator);
    assert.equal(result.lecture.opportunity_id, ZARQA_OPP);
    assert.equal(store.lectures[0].unique_watched_seconds, undefined);
    assert.equal(lectureMappers.mapStudentLectureRow(store.lectures[0]).title, '<script>alert(1)</script>');
  });

  it('has hide/publish but no hard-delete lecture route', () => {
    const routes = read('src/modules/fieldTraining/fieldTraining.recordedLectures.routes.js');
    assert.match(routes, /controller\.hideById/);
    assert.match(routes, /controller\.publishById/);
    assert.equal(/controller\.delete/.test(routes), false);
    assert.equal(/router\.delete\(/.test(routes), false);
  });
});

describe('Phase 7 heartbeat malice, idempotency, and seek-to-end', () => {
  it('rejects inverted range, huge span, and does not accept client completion fields', async () => {
    const { service, lectureId, store } = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    await assert.rejects(
      () => play(service, { lectureId, session, seq: 1, from: 100, to: 50 }),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
    await assert.rejects(
      () => play(service, { lectureId, session, seq: 1, from: 0, to: 3600 }),
      (err) => err instanceof ApiError && err.code === 'RECORDED_LECTURE_HEARTBEAT_SPAN_TOO_LARGE'
    );
    const ok = await play(service, {
      lectureId,
      session,
      seq: 1,
      from: 0,
      to: 10,
      extra: { uniqueWatchedSeconds: 99999, progressPercentage: 100, completedAt: new Date().toISOString() },
    });
    assert.equal(ok.progress.uniqueWatchedSeconds, 10);
    assert.equal(ok.progress.completedAt, null);
    assert.equal(store.progress.length, 1);
  });

  it('rejects NaN/Infinity/overflow at the heartbeat schema', () => {
    const session = crypto.randomUUID();
    const base = {
      watchSessionId: session,
      sequenceNumber: 1,
      fromSecond: 0,
      toSecond: 10,
      playerState: 'PLAYING',
    };
    assert.throws(() => heartbeatBodySchema.parse({ ...base, fromSecond: Number.NaN }));
    assert.throws(() => heartbeatBodySchema.parse({ ...base, toSecond: Number.POSITIVE_INFINITY }));
    assert.throws(() => heartbeatBodySchema.parse({ ...base, fromSecond: -1 }));
    assert.throws(() => heartbeatBodySchema.parse({ ...base, toSecond: 999999999999 }));
    assert.throws(() => heartbeatBodySchema.parse({ ...base, fromSecond: 20, toSecond: 10 }));
  });

  it('does not invent coverage from out-of-order or duplicate sequences', async () => {
    const { service, lectureId } = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    await play(service, { lectureId, session, seq: 5, from: 40, to: 50 });
    const older = await play(service, { lectureId, session, seq: 4, from: 0, to: 10 });
    assert.equal(older.duplicate, true);
    assert.equal(older.progress.uniqueWatchedSeconds, 10);
    const next = await play(service, { lectureId, session, seq: 6, from: 50, to: 60 });
    assert.equal(next.progress.uniqueWatchedSeconds, 20);
  });

  it('seek-to-end plus ENDED stays incomplete at ~40 unique seconds', async () => {
    const { service, lectureId } = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    const first = await playRange(service, { lectureId, session, from: 0, to: 30 });
    const second = await playRange(service, {
      lectureId,
      session,
      from: 3590,
      to: 3600,
      startSeq: first.nextSeq,
    });
    const ended = await play(service, {
      lectureId,
      session,
      seq: second.nextSeq,
      from: 3600,
      to: 3600,
      state: PLAYER_STATES.ENDED,
    });
    assert.equal(ended.progress.uniqueWatchedSeconds, 40);
    assert.equal(ended.progress.progressPercentage, 1.11);
    assert.equal(ended.progress.completedAt, null);
    assert.equal(ended.progress.watchStatus, 'in_progress');
  });

  it('keeps unique vs last-position distinct after a long seek', async () => {
    const { service, lectureId } = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    const watched = await playRange(service, { lectureId, session, from: 0, to: 100 });
    await play(service, {
      lectureId,
      session,
      seq: watched.nextSeq,
      from: 3500,
      to: 3500,
      state: PLAYER_STATES.SEEKING,
    });
    const progress = (await service.getProgress(ZARQA_OPP, lectureId, STUDENT_ZARQA)).progress;
    assert.equal(progress.uniqueWatchedSeconds, 100);
    assert.equal(progress.lastPositionSeconds, 3500);
    assert.equal(progress.progressPercentage, 2.78);
  });
});

describe('Phase 7 reorder, YouTube SSRF, and source contracts', () => {
  it('rejects duplicate, incomplete, and foreign reorder IDs', () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const foreign = crypto.randomUUID();
    assert.throws(() => assertReorderPayload([a, b], [a, a]), (err) => err.statusCode === 400);
    assert.throws(() => assertReorderPayload([a, b], [a]), (err) => err.statusCode === 400);
    assert.throws(() => assertReorderPayload([a, b], [a, foreign]), (err) => err.statusCode === 400);
    assert.doesNotThrow(() => assertReorderPayload([a, b], [b, a]));
  });

  it('accepts YouTube URL shapes and rejects SSRF-like inputs without fetching', () => {
    assert.equal(parseYoutubeVideoInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ').videoId, VIDEO_ID);
    assert.equal(parseYoutubeVideoInput('https://youtu.be/dQw4w9WgXcQ').videoId, VIDEO_ID);
    assert.equal(parseYoutubeVideoInput('https://www.youtube.com/embed/dQw4w9WgXcQ').videoId, VIDEO_ID);
    assert.equal(parseYoutubePlaylistInput('https://www.youtube.com/playlist?list=PLtestplaylistid').playlistId, 'PLtestplaylistid');
    assert.equal(
      parseYoutubeVideoInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtestplaylistid').playlistId,
      'PLtestplaylistid'
    );
    const blocked = [
      'https://example.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'http://127.0.0.1/watch?v=dQw4w9WgXcQ',
      'http://localhost/watch?v=dQw4w9WgXcQ',
      'file:///etc/passwd',
      'data:text/html,hi',
      'not a url',
    ];
    for (const raw of blocked) {
      assert.throws(() => parseYoutubeVideoInput(raw));
    }
  });

  it('does not wire analytics, reports, scoring, or attendance into recorded lectures', () => {
    const service = read('src/modules/fieldTraining/fieldTraining.recordedLectures.service.js');
    const watch = read('src/modules/fieldTraining/fieldTraining.recordedLectures.watch.service.js');
    const routes = read('src/modules/fieldTraining/fieldTraining.recordedLectures.routes.js');
    const report = read('src/modules/fieldTraining/fieldTraining.comprehensiveReport.service.js');
    const scoring = read('src/modules/fieldTraining/fieldTrainingEvaluation.scoring.js');
    const official = read('src/modules/fieldTraining/fieldTraining.officialResult.service.js');
    assert.equal(/recordedLectureAnalytics|resolveRecordedLecture/.test(routes + service), false);
    assert.equal(/fieldTrainingReport|officialResult|attendance_percentage/.test(watch), false);
    assert.equal(/recorded_lecture/.test(report), false);
    assert.equal(/recorded_lecture/.test(scoring), false);
    assert.equal(/recorded_lecture/.test(official), false);
    assert.match(routes, /recordedLectureHeartbeatLimiter/);
  });

  it('keeps overlapping known segments as a 1500-second unique union', () => {
    const merged = mergeIntervals([
      [0, 600],
      [300, 900],
      [1800, 2400],
    ]);
    assert.deepEqual(merged, [
      [0, 900],
      [1800, 2400],
    ]);
    assert.equal(uniqueWatchedSeconds(merged), 1500);
  });
});
