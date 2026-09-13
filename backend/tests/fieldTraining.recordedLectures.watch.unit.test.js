'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../src/utils/apiError');
const {
  mergeIntervals,
  uniqueWatchedSeconds,
  computeProgressPercentage,
  reachedCompletion,
  resumePositionSeconds,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.intervals');
const {
  createWatchService,
  PLAYER_STATES,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.watch.service');
const {
  DEFAULT_COMPLETION_THRESHOLD_PERCENT,
  MAX_HEARTBEAT_SPAN_SECONDS,
  getCompletionThresholdPercent,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.watch.constants');

const ROOT = path.join(__dirname, '..');
const ZARQA_UNI = '4b85f423-c543-499e-9765-a5248dbfa583';
const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const ZARQA_OPP = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const STUDENT_ZARQA = '33333333-3333-4333-8333-333333333333';
const STUDENT_OTHER = '44444444-4444-4444-8444-444444444444';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
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
        provider_video_id: 'dQw4w9WgXcQ',
        title: 'React Components',
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
      return (
        store.applications.find(
          (row) => row.opportunity_id === oppId && row.student_id === studentId
        ) || null
      );
    },
    async listProgressByApplicationAndLectureIds(appId, lectureIds) {
      return store.progress.filter(
        (row) => row.application_id === appId && lectureIds.includes(row.lecture_id)
      );
    },
    async ensureProgress({ lectureId: lecId, applicationId: appId, studentId, videoDurationSeconds }) {
      let row = store.progress.find((item) => item.lecture_id === lecId && item.application_id === appId);
      if (row) return row;
      row = {
        id: crypto.randomUUID(),
        lecture_id: lecId,
        application_id: appId,
        student_id: studentId,
        video_duration_seconds: videoDurationSeconds ?? null,
        unique_watched_seconds: 0,
        total_playback_seconds: 0,
        last_position_seconds: 0,
        progress_percentage: null,
        started_at: null,
        last_watched_at: null,
        completed_at: null,
        heartbeat_cursors: {},
        segments: [],
        created_at: new Date(),
        updated_at: new Date(),
      };
      store.progress.push(row);
      return row;
    },
    async applyHeartbeatTransaction({ progressId, next, segments, duplicate }) {
      const row = store.progress.find((item) => item.id === progressId);
      if (!row) return null;
      if (duplicate) return row;
      row.video_duration_seconds = next.video_duration_seconds;
      row.unique_watched_seconds = next.unique_watched_seconds;
      row.total_playback_seconds = next.total_playback_seconds;
      row.last_position_seconds = next.last_position_seconds;
      row.progress_percentage = next.progress_percentage;
      row.started_at = next.started_at;
      row.last_watched_at = next.last_watched_at;
      row.completed_at = next.completed_at;
      row.heartbeat_cursors = next.heartbeat_cursors;
      row.segments = segments.map(([start, end]) => ({ start_second: start, end_second: end }));
      row.updated_at = new Date();
      return row;
    },
  };

  const service = createWatchService({
    watchRepo,
    queryCounter: store.queries,
    getCompletionThresholdPercent: () => DEFAULT_COMPLETION_THRESHOLD_PERCENT,
  });

  return { store, service, lectureId, applicationId };
}

async function play(service, { opportunityId = ZARQA_OPP, lectureId, studentId = STUDENT_ZARQA, session, seq, from, to, state = 'PLAYING' }) {
  return service.processHeartbeat(opportunityId, lectureId, studentId, {
    watchSessionId: session,
    sequenceNumber: seq,
    fromSecond: from,
    toSecond: to,
    currentTime: to,
    playerState: state,
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

describe('recorded lecture interval merge', () => {
  it('merges overlap, adjacency, contained, unordered, and skips zero-length', () => {
    assert.deepEqual(mergeIntervals([[0, 10], [10, 20], [30, 40], [35, 50]]), [
      [0, 20],
      [30, 50],
    ]);
    assert.equal(uniqueWatchedSeconds([[0, 10], [10, 20], [30, 40], [35, 50]]), 40);
    assert.deepEqual(mergeIntervals([[18, 30], [0, 10], [10, 20], [31, 40]], { gapTolerance: 2 }), [
      [0, 40],
    ]);
    assert.deepEqual(mergeIntervals([[0, 600], [300, 900]]), [[0, 900]]);
    assert.equal(uniqueWatchedSeconds([[0, 600], [300, 900]]), 900);
    assert.deepEqual(mergeIntervals([[5, 8], [0, 20]]), [[0, 20]]);
    assert.deepEqual(mergeIntervals([[0, 60], [0, 60]]), [[0, 60]]);
    assert.deepEqual(mergeIntervals([[40, 50], [0, 10]]), [
      [0, 10],
      [40, 50],
    ]);
    assert.deepEqual(mergeIntervals([[5, 5], [0, 0]]), []);
    assert.deepEqual(mergeIntervals([[-4, 10], [12, 20]]), [[0, 20]]);
  });

  it('does not merge large unobserved gaps', () => {
    assert.deepEqual(mergeIntervals([[0, 10], [40, 50]], { gapTolerance: 2 }), [
      [0, 10],
      [40, 50],
    ]);
  });
});

describe('recorded lecture completion math', () => {
  it('completes at 90% unique watched and not below', () => {
    assert.equal(reachedCompletion(899, 1000, 90), false);
    assert.equal(reachedCompletion(900, 1000, 90), true);
    assert.equal(reachedCompletion(1000, 1000, 90), true);
    assert.equal(computeProgressPercentage(3240, 3600), 90);
    assert.equal(computeProgressPercentage(100, 3600), 2.78);
    assert.equal(computeProgressPercentage(10, null), null);
    assert.equal(getCompletionThresholdPercent(), 90);
  });

  it('does not resume at exact end when complete', () => {
    assert.equal(
      resumePositionSeconds({ lastPositionSeconds: 3599, durationSeconds: 3600, completedAt: new Date() }),
      0
    );
    assert.equal(
      resumePositionSeconds({ lastPositionSeconds: 1250, durationSeconds: 3600, completedAt: null }),
      1250
    );
  });
});

describe('recorded lecture watch tracking', () => {
  it('counts normal watch, ignore pause/buffering, and uses server completion', async () => {
    const { service, lectureId, store } = makeWatchHarness({ duration: 1000 });
    const session = crypto.randomUUID();
    const { last: first, nextSeq } = await playRange(service, { lectureId, session, from: 0, to: 300 });
    assert.equal(first.progress.uniqueWatchedSeconds, 300);
    assert.equal(first.progress.totalPlaybackSeconds, 300);
    assert.equal(first.progress.lastPositionSeconds, 300);
    assert.equal(first.progress.watchStatus, 'in_progress');
    assert.ok(first.progress.startedAt);

    await play(service, { lectureId, session, seq: nextSeq, from: 300, to: 300, state: PLAYER_STATES.PAUSED });
    assert.equal(store.progress[0].unique_watched_seconds, 300);

    await play(service, { lectureId, session, seq: nextSeq + 1, from: 300, to: 300, state: PLAYER_STATES.BUFFERING });
    assert.equal(store.progress[0].unique_watched_seconds, 300);
  });

  it('does not count forward seek distance and supports backward rewatch totals', async () => {
    const { service, lectureId } = makeWatchHarness();
    const session = crypto.randomUUID();
    await playRange(service, { lectureId, session, from: 0, to: 60 });
    await playRange(service, { lectureId, session, startSeq: 20, from: 600, to: 660 });
    const afterSeek = await service.getProgress(ZARQA_OPP, lectureId, STUDENT_ZARQA);
    assert.equal(afterSeek.progress.uniqueWatchedSeconds, 120);

    const { service: svc2, lectureId: lec2 } = makeWatchHarness();
    const s2 = crypto.randomUUID();
    await playRange(svc2, { lectureId: lec2, session: s2, from: 0, to: 600 });
    await playRange(svc2, { lectureId: lec2, session: s2, startSeq: 80, from: 300, to: 500 });
    const backward = await svc2.getProgress(ZARQA_OPP, lec2, STUDENT_ZARQA);
    assert.equal(backward.progress.uniqueWatchedSeconds, 600);
    assert.equal(backward.progress.totalPlaybackSeconds, 800);
  });

  it('does not double unique on rewatch, overlapping, or duplicate heartbeat', async () => {
    const { service, lectureId } = makeWatchHarness();
    const session = crypto.randomUUID();
    const first = await playRange(service, { lectureId, session, from: 0, to: 60 });
    await playRange(service, { lectureId, session, startSeq: first.nextSeq, from: 0, to: 60 });
    let progress = (await service.getProgress(ZARQA_OPP, lectureId, STUDENT_ZARQA)).progress;
    assert.equal(progress.uniqueWatchedSeconds, 60);
    assert.equal(progress.totalPlaybackSeconds, 120);

    const dup = await play(service, { lectureId, session, seq: first.nextSeq, from: 0, to: 10 });
    assert.equal(dup.duplicate, true);
    assert.equal(dup.progress.uniqueWatchedSeconds, 60);
    assert.equal(dup.progress.totalPlaybackSeconds, 120);
  });

  it('keeps unique correct across two watch sessions / tabs', async () => {
    const { service, lectureId } = makeWatchHarness();
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    await playRange(service, { lectureId, session: a, from: 0, to: 60 });
    await playRange(service, { lectureId, session: b, from: 30, to: 90 });
    const progress = (await service.getProgress(ZARQA_OPP, lectureId, STUDENT_ZARQA)).progress;
    assert.equal(progress.uniqueWatchedSeconds, 90);
    assert.equal(progress.totalPlaybackSeconds, 120);
  });

  it('blocks seek-to-end cheating and does not complete from ENDED', async () => {
    const { service, lectureId } = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    const watched = await playRange(service, { lectureId, session, from: 3500, to: 3600 });
    const cheated = await service.getProgress(ZARQA_OPP, lectureId, STUDENT_ZARQA);
    assert.equal(cheated.progress.uniqueWatchedSeconds, 100);
    assert.equal(cheated.progress.progressPercentage, 2.78);
    assert.equal(cheated.progress.completedAt, null);

    const ended = await play(service, {
      lectureId,
      session,
      seq: watched.nextSeq,
      from: 3600,
      to: 3600,
      state: PLAYER_STATES.ENDED,
    });
    assert.equal(ended.progress.completedAt, null);
    assert.equal(ended.progress.uniqueWatchedSeconds, 100);
  });

  it('marks complete at 900/1000 and never clears completedAt', async () => {
    const { service: svc, lectureId: lec, store: st } = makeWatchHarness({ duration: 1000 });
    const s = crypto.randomUUID();
    let seq = 1;
    let cursor = 0;
    while (cursor < 899) {
      const next = Math.min(899, cursor + 10);
      await play(svc, { lectureId: lec, session: s, seq, from: cursor, to: next });
      seq += 1;
      cursor = next;
    }
    const below = await svc.getProgress(ZARQA_OPP, lec, STUDENT_ZARQA);
    assert.equal(below.progress.uniqueWatchedSeconds, 899);
    assert.equal(below.progress.completedAt, null);

    const done = await play(svc, { lectureId: lec, session: s, seq, from: 899, to: 900 });
    assert.ok(done.progress.completedAt);
    assert.equal(done.progress.watchStatus, 'completed');
    const firstCompleted = done.progress.completedAt;
    await play(svc, { lectureId: lec, session: s, seq: seq + 1, from: 900, to: 910 });
    assert.equal(String(st.progress[0].completed_at), String(firstCompleted));
  });

  it('does not set startedAt or unique time from opening a session', async () => {
    const { service, lectureId } = makeWatchHarness();
    const started = await service.startWatchSession(ZARQA_OPP, lectureId, STUDENT_ZARQA, {});
    assert.equal(started.progress.uniqueWatchedSeconds, 0);
    assert.equal(started.progress.startedAt, null);
    assert.ok(started.watchSessionId);
  });

  it('returns stored last position for resume without changing unique until playback', async () => {
    const { service, lectureId, store } = makeWatchHarness();
    store.progress.push({
      id: crypto.randomUUID(),
      lecture_id: lectureId,
      application_id: store.applications[0].id,
      student_id: STUDENT_ZARQA,
      video_duration_seconds: 3600,
      unique_watched_seconds: 400,
      total_playback_seconds: 400,
      last_position_seconds: 1250,
      progress_percentage: 11.11,
      started_at: new Date(),
      last_watched_at: new Date(),
      completed_at: null,
      heartbeat_cursors: {},
      segments: [{ start_second: 0, end_second: 400 }],
    });
    const started = await service.startWatchSession(ZARQA_OPP, lectureId, STUDENT_ZARQA, {});
    assert.equal(started.progress.lastPositionSeconds, 1250);
    assert.equal(started.progress.resumePositionSeconds, 1250);
    assert.equal(started.progress.uniqueWatchedSeconds, 400);
  });

  it('rejects oversized heartbeats, other opportunity, draft/hidden, and unenrolled students', async () => {
    const published = makeWatchHarness({ duration: 3600 });
    const session = crypto.randomUUID();
    await assert.rejects(
      () =>
        play(published.service, {
          lectureId: published.lectureId,
          session,
          seq: 1,
          from: 0,
          to: 5400,
        }),
      (err) => err instanceof ApiError && err.statusCode === 400
    );

    await assert.rejects(
      () =>
        play(published.service, {
          opportunityId: TAFILA_OPP,
          lectureId: published.lectureId,
          session,
          seq: 1,
          from: 0,
          to: 10,
        }),
      (err) => err instanceof ApiError && err.statusCode === 404
    );

    await assert.rejects(
      () => play(published.service, { lectureId: published.lectureId, studentId: STUDENT_OTHER, session, seq: 1, from: 0, to: 10 }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );

    const draft = makeWatchHarness({ status: 'draft' });
    await assert.rejects(
      () =>
        play(draft.service, {
          lectureId: draft.lectureId,
          session: crypto.randomUUID(),
          seq: 1,
          from: 0,
          to: 10,
        }),
      (err) => err instanceof ApiError && err.statusCode === 404
    );

    const hidden = makeWatchHarness({ status: 'hidden' });
    await assert.rejects(
      () =>
        play(hidden.service, {
          lectureId: hidden.lectureId,
          session: crypto.randomUUID(),
          seq: 1,
          from: 0,
          to: 10,
        }),
      (err) => err instanceof ApiError && err.statusCode === 404
    );
  });

  it('keeps heartbeat queries minimal and away from scoring/reports', async () => {
    const { service, lectureId, store } = makeWatchHarness();
    store.queries.length = 0;
    await play(service, { lectureId, session: crypto.randomUUID(), seq: 1, from: 0, to: 10 });
    assert.ok(store.queries.includes('lecture'));
    assert.ok(store.queries.includes('application'));
    assert.ok(store.queries.includes('heartbeatTx'));
    assert.equal(store.queries.includes('opportunity'), false);
    assert.ok(store.queries.length <= 6);

    const src = read('src/modules/fieldTraining/fieldTraining.recordedLectures.watch.service.js');
    assert.equal(/fieldTrainingReport|officialResult|workflowService|scoring/.test(src), false);
    assert.equal(src.includes('YOUTUBE_API_KEY'), false);
    assert.ok(MAX_HEARTBEAT_SPAN_SECONDS >= 25);
    assert.equal(ZARQA_UNI.startsWith('4b85'), true);
  });
});

describe('recorded lecture watch tracker is not imported from backend youtube key', () => {
  it('does not expose YouTube Data API key to student player files', () => {
    const player = read('../frontend/src/pages/student/fieldTraining/components/YouTubeRecordedLecturePlayer.jsx');
    const service = read('../frontend/src/features/fieldTraining/fieldTraining.service.js');
    assert.match(player, /youtube\.com\/iframe_api/);
    assert.equal(/YOUTUBE_API_KEY/.test(player), false);
    assert.equal(/YOUTUBE_API_KEY/.test(service), false);
    assert.match(service, /recorded-lectures\/\$\{lectureId\}\/heartbeat/);
  });
});
