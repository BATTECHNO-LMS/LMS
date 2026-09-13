'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../src/utils/apiError');
const {
  createService,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.service');
const lectureMappers = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');
const { createYoutubeImportService } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeImport.service');
const { assertReorderPayload } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');

const ROOT = path.join(__dirname, '..');
const FRONTEND_ROOT = path.join(ROOT, '..', 'frontend');
const ZARQA_UNI = '4b85f423-c543-499e-9765-a5248dbfa583';
const TAFILA_UNI = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZARQA_OPP = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const ZARQA_SESSION = '11111111-1111-4111-8111-111111111111';
const TAFILA_SESSION = '22222222-2222-4222-8222-222222222222';
const PLAYLIST_ID = 'PLtestPlay01';
const STUDENT_ZARQA = '33333333-3333-4333-8333-333333333333';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function vid(n) {
  return `v${String(n).padStart(10, '0')}`;
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

function videoItem(id, overrides = {}) {
  return {
    id,
    snippet: {
      title: overrides.title || `Title ${id}`,
      description: overrides.description || `Description ${id}`,
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
    },
    playlistPosition: overrides.playlistPosition,
    contentDetails: { duration: overrides.duration || 'PT1M' },
    status: {
      privacyStatus: overrides.privacyStatus || 'public',
      uploadStatus: overrides.uploadStatus || 'processed',
    },
  };
}

function makeStore() {
  return {
    opportunities: [
      {
        id: ZARQA_OPP,
        title: 'Zarqa FT',
        university_id: ZARQA_UNI,
        assigned_instructor_id: null,
        status: 'published',
      },
      {
        id: TAFILA_OPP,
        title: 'Tafila FT',
        university_id: TAFILA_UNI,
        assigned_instructor_id: null,
        status: 'published',
      },
    ],
    sessions: [
      { id: ZARQA_SESSION, opportunity_id: ZARQA_OPP, title: 'المحاضرة الخامسة' },
      { id: TAFILA_SESSION, opportunity_id: TAFILA_OPP, title: 'جلسة الطفيلة' },
    ],
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

function createLectureRepo(store) {
  return {
    mapLectureRow: lectureMappers.mapLectureRow,
    mapStudentLectureRow: lectureMappers.mapStudentLectureRow,
    async listByOpportunity(opportunityId, { status } = {}) {
      return store.lectures
        .filter((row) => row.opportunity_id === opportunityId && (!status || row.status === status))
        .sort((a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)));
    },
    async findById(id) {
      const row = store.lectures.find((item) => item.id === id);
      if (!row) return null;
      return {
        ...row,
        field_training_opportunities: store.opportunities.find((o) => o.id === row.opportunity_id),
        field_training_sessions: store.sessions.find((s) => s.id === row.session_id) || null,
      };
    },
    async findMaxSortOrder(opportunityId) {
      const rows = store.lectures.filter((row) => row.opportunity_id === opportunityId);
      if (!rows.length) return null;
      return Math.max(...rows.map((row) => row.sort_order));
    },
    async listYoutubeVideoIds(opportunityId) {
      return new Set(
        store.lectures
          .filter((row) => row.opportunity_id === opportunityId && row.provider === 'youtube')
          .map((row) => row.provider_video_id)
      );
    },
    async createLecture(data) {
      const dup = store.lectures.find(
        (row) =>
          row.opportunity_id === data.opportunity_id &&
          row.provider === data.provider &&
          row.provider_video_id === data.provider_video_id
      );
      if (dup) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const row = {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
        field_training_sessions: store.sessions.find((s) => s.id === data.session_id) || null,
      };
      store.lectures.push(row);
      return row;
    },
    async createManyLectures(rows) {
      let count = 0;
      for (const data of rows) {
        try {
          await this.createLecture(data);
          count += 1;
        } catch (err) {
          if (err.code !== 'P2002') throw err;
        }
      }
      return { count };
    },
    async updateLecture(id, data) {
      const idx = store.lectures.findIndex((row) => row.id === id);
      if (idx < 0) throw Object.assign(new Error('not found'), { code: 'P2025' });
      store.lectures[idx] = { ...store.lectures[idx], ...data, updated_at: new Date() };
      return {
        ...store.lectures[idx],
        field_training_sessions: store.sessions.find((s) => s.id === store.lectures[idx].session_id) || null,
      };
    },
    async reorderLectures(opportunityId, orderedIds) {
      const current = store.lectures.filter((row) => row.opportunity_id === opportunityId);
      assertReorderPayload(
        current.map((row) => row.id),
        orderedIds
      );
      orderedIds.forEach((id, index) => {
        const row = store.lectures.find((item) => item.id === id);
        row.sort_order = index + 1;
        row.updated_at = new Date();
      });
      return this.listByOpportunity(opportunityId);
    },
  };
}

function createHarness(store = makeStore()) {
  const lectureRepo = createLectureRepo(store);
  const audits = [];
  const ftRepo = {
    async findById(id) {
      return store.opportunities.find((row) => row.id === id) || null;
    },
    async findPublishedById(id) {
      const row = store.opportunities.find((item) => item.id === id);
      if (!row || !['published', 'in_progress'].includes(row.status)) return null;
      return row;
    },
    async findSessionById(id) {
      return store.sessions.find((row) => row.id === id) || null;
    },
    async findApplicationByOpportunityAndStudent(opportunityId, studentId) {
      return (
        store.applications.find(
          (row) => row.opportunity_id === opportunityId && row.student_id === studentId
        ) || null
      );
    },
  };
  const service = createService({
    lectureRepo,
    ftRepo,
    recordAudit: async (payload) => audits.push(payload),
    assertStudentCanAccessOpportunity: async (opportunity, studentId) => {
      if (studentId === STUDENT_ZARQA && opportunity.id === ZARQA_OPP) return;
      throw new ApiError(403, 'forbidden', null, 'FIELD_TRAINING_NOT_ELIGIBLE');
    },
  });
  return { store, service, audits, lectureRepo, ftRepo };
}

function createCatalogClient({ playlistId = PLAYLIST_ID, playlistTitle = 'Full Stack Training', videos = [] } = {}) {
  const byId = new Map(videos.map((item) => [item.id, item]));
  const items = videos.map((item, index) => ({
    snippet: {
      position: item.playlistPosition ?? index,
      title: item.snippet?.title,
      resourceId: { videoId: item.id },
    },
    contentDetails: { videoId: item.id },
  }));
  return {
    async getVideo(id) {
      return byId.get(id) || null;
    },
    async getVideos(ids) {
      const map = new Map();
      for (const id of ids) if (byId.has(id)) map.set(id, byId.get(id));
      return map;
    },
    async getPlaylist(id) {
      if (id !== playlistId) return null;
      return { id, snippet: { title: playlistTitle } };
    },
    async listPlaylistItems(id) {
      if (id !== playlistId) return { items: [], totalResults: 0 };
      return { items, totalResults: items.length };
    },
  };
}

async function seedPlaylist(service, admin, count = 4) {
  const ids = [];
  for (let i = 1; i <= count; i += 1) {
    const created = await service.createForOpportunity(
      ZARQA_OPP,
      {
        title: `Lecture ${i}`,
        provider: 'YOUTUBE',
        provider_video_id: vid(i),
        source_type: 'PLAYLIST',
        source_playlist_id: PLAYLIST_ID,
        source_playlist_url: `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`,
        status: i === 2 ? 'PUBLISHED' : i === 3 ? 'HIDDEN' : 'DRAFT',
      },
      admin
    );
    ids.push(created.lecture.id);
  }
  return ids;
}

describe('Recorded lectures admin management', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });

  it('lists draft, published, and hidden lectures with playlist sources in one response', async () => {
    const { service } = createHarness();
    await seedPlaylist(service, admin, 3);
    const listed = await service.listForStaff(ZARQA_OPP, admin);
    assert.equal(listed.lectures.length, 3);
    assert.equal(listed.counts.total, 3);
    assert.equal(listed.counts.published, 1);
    assert.equal(listed.counts.hidden, 1);
    assert.equal(listed.playlistSources.length, 1);
    assert.equal(listed.playlistSources[0].playlistId, PLAYLIST_ID);
  });

  it('edits local title and description without changing providerVideoId', async () => {
    const { service, store } = createHarness();
    const [id] = await seedPlaylist(service, admin, 1);
    const updated = await service.updateLecture(
      id,
      { title: 'عنوان محلي', description: 'وصف محلي' },
      admin
    );
    assert.equal(updated.lecture.title, 'عنوان محلي');
    assert.equal(updated.lecture.description, 'وصف محلي');
    assert.equal(updated.lecture.provider_video_id, vid(1));
    assert.equal(store.lectures[0].provider_video_id, vid(1));
    await assert.rejects(
      () => service.updateLecture(id, { provider_video_id: vid(9) }, admin),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
  });

  it('rejects a session from another opportunity and allows clearing the session', async () => {
    const { service } = createHarness();
    const [id] = await seedPlaylist(service, admin, 1);
    await assert.rejects(
      () => service.updateLecture(id, { session_id: TAFILA_SESSION }, admin),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
    const linked = await service.updateLecture(id, { session_id: ZARQA_SESSION }, admin);
    assert.equal(linked.lecture.session_id, ZARQA_SESSION);
    const cleared = await service.updateLecture(id, { session_id: null }, admin);
    assert.equal(cleared.lecture.session_id, null);
  });

  it('publishes, hides, and returns a lecture to draft', async () => {
    const { service, audits } = createHarness();
    const [id] = await seedPlaylist(service, admin, 1);
    const published = await service.setStatus(id, 'PUBLISHED', admin);
    assert.equal(published.lecture.status, 'PUBLISHED');
    const hidden = await service.setStatus(id, 'HIDDEN', admin);
    assert.equal(hidden.lecture.status, 'HIDDEN');
    const draft = await service.setStatus(id, 'DRAFT', admin);
    assert.equal(draft.lecture.status, 'DRAFT');
    assert.equal(
      audits.some((row) => row.actionType === 'RECORDED_LECTURE_PUBLISHED'),
      true
    );
    assert.equal(
      audits.some((row) => row.actionType === 'RECORDED_LECTURE_HIDDEN'),
      true
    );
  });
});

describe('Recorded lectures reorder', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });

  it('persists first-to-last, last-to-first, and middle moves as 1..N', async () => {
    const { service, store, audits } = createHarness();
    const ids = await seedPlaylist(service, admin, 4);
    const firstToLast = await service.reorderLectures(ZARQA_OPP, { lecture_ids: [...ids.slice(1), ids[0]] }, admin);
    assert.deepEqual(
      firstToLast.lectures.map((row) => row.id),
      [...ids.slice(1), ids[0]]
    );
    assert.deepEqual(
      firstToLast.lectures.map((row) => row.sort_order),
      [1, 2, 3, 4]
    );
    const lastToFirst = await service.reorderLectures(
      ZARQA_OPP,
      { lecture_ids: [ids[0], ids[1], ids[2], ids[3]] },
      admin
    );
    assert.equal(lastToFirst.lectures[0].id, ids[0]);
    const middle = [ids[0], ids[2], ids[1], ids[3]];
    const moved = await service.reorderLectures(ZARQA_OPP, { lecture_ids: middle }, admin);
    assert.deepEqual(moved.lectures.map((row) => row.id), middle);
    assert.ok(store.lectures.every((row) => row.sort_order >= 1 && row.sort_order <= 4));
    assert.equal(audits.some((row) => row.actionType === 'RECORDED_LECTURES_REORDERED'), true);
  });

  it('rejects duplicate IDs, foreign opportunity IDs, and incomplete sets', async () => {
    const { service } = createHarness();
    const ids = await seedPlaylist(service, admin, 3);
    await assert.rejects(
      () => service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[0], ids[0], ids[1]] }, admin),
      (err) => err.code === 'RECORDED_LECTURE_REORDER_DUPLICATE'
    );
    await assert.rejects(
      () => service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[0], ids[1]] }, admin),
      (err) => err.code === 'RECORDED_LECTURE_REORDER_INCOMPLETE'
    );
    const tafilaAdmin = user({ roles: ['admin'], universityId: TAFILA_UNI });
    const other = await service.createForOpportunity(
      TAFILA_OPP,
      { title: 'Other', provider: 'YOUTUBE', provider_video_id: vid(8) },
      tafilaAdmin
    );
    await assert.rejects(
      () => service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[0], ids[1], other.lecture.id] }, admin),
      (err) => err.code === 'RECORDED_LECTURE_REORDER_FOREIGN'
    );
  });

  it('keeps last successful reorder without duplicate sortOrder values', async () => {
    const { service, store } = createHarness();
    const ids = await seedPlaylist(service, admin, 3);
    await Promise.all([
      service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[2], ids[1], ids[0]] }, admin),
      service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[0], ids[1], ids[2]] }, admin),
    ]);
    const orders = store.lectures.map((row) => row.sort_order).sort();
    assert.deepEqual(orders, [1, 2, 3]);
  });
});

describe('Recorded lectures playlist sync', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });

  function syncHarness(videos) {
    const { store, service, lectureRepo, ftRepo, audits } = createHarness();
    const youtube = createYoutubeImportService({
      lectureRepo,
      ftRepo,
      youtubeClient: createCatalogClient({ videos }),
      recordAudit: async (payload) => audits.push(payload),
    });
    return { store, service, youtube, audits };
  }

  it('scenario A: unchanged playlist reports NEW=0 and does not import', async () => {
    const videos = [videoItem(vid(1)), videoItem(vid(2)), videoItem(vid(3))];
    const { service, youtube, store } = syncHarness(videos);
    await seedPlaylist(service, admin, 3);
    const preview = await youtube.previewPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID }, admin);
    assert.equal(preview.counts.newCount, 0);
    assert.equal(preview.counts.existing, 3);
    const applied = await youtube.applyPlaylistSync(
      ZARQA_OPP,
      { playlist_id: PLAYLIST_ID, import_all: true },
      admin
    );
    assert.equal(applied.summary.imported, 0);
    assert.equal(store.lectures.length, 3);
  });

  it('scenario B: new videos are detected but not imported until confirmed', async () => {
    const videos = [videoItem(vid(1)), videoItem(vid(2)), videoItem(vid(3)), videoItem(vid(4)), videoItem(vid(5))];
    const { service, youtube, store } = syncHarness(videos);
    await seedPlaylist(service, admin, 3);
    const preview = await youtube.previewPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID }, admin);
    assert.equal(preview.counts.newCount, 2);
    assert.equal(store.lectures.length, 3);
    const selected = await youtube.applyPlaylistSync(
      ZARQA_OPP,
      { playlist_id: PLAYLIST_ID, video_ids: [vid(5)] },
      admin
    );
    assert.equal(selected.summary.imported, 1);
    assert.equal(store.lectures.some((row) => row.provider_video_id === vid(5)), true);
    assert.equal(store.lectures.some((row) => row.provider_video_id === vid(4)), false);
    const rest = await youtube.applyPlaylistSync(
      ZARQA_OPP,
      { playlist_id: PLAYLIST_ID, import_all: true },
      admin
    );
    assert.equal(rest.summary.imported, 1);
    const originals = store.lectures.filter((row) => ['v0000000001', 'v0000000002', 'v0000000003'].includes(row.provider_video_id));
    assert.ok(originals.every((row) => row.sort_order <= 3));
    const appended = store.lectures
      .filter((row) => row.provider_video_id === vid(4) || row.provider_video_id === vid(5))
      .sort((a, b) => a.sort_order - b.sort_order);
    assert.equal(appended[0].provider_video_id, vid(5));
    assert.equal(appended[1].provider_video_id, vid(4));
    assert.ok(appended[0].sort_order > 2);
    assert.ok(appended.every((row) => row.status === 'draft'));
  });

  it('scenario C: removed source videos are flagged and not deleted', async () => {
    const videos = [videoItem(vid(1)), videoItem(vid(2))];
    const { service, youtube, store } = syncHarness(videos);
    await seedPlaylist(service, admin, 3);
    const preview = await youtube.previewPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID }, admin);
    assert.equal(preview.counts.removedFromSource, 1);
    assert.equal(preview.removedFromSource[0].providerVideoId, vid(3));
    assert.equal(store.lectures.length, 3);
    await youtube.applyPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID, import_all: true }, admin);
    assert.equal(store.lectures.length, 3);
  });

  it('scenario D: YouTube playlist reorder does not overwrite LMS sortOrder', async () => {
    const videos = [
      videoItem(vid(3), { playlistPosition: 0 }),
      videoItem(vid(1), { playlistPosition: 1 }),
      videoItem(vid(2), { playlistPosition: 2 }),
    ];
    const { service, youtube, store } = syncHarness(videos);
    const ids = await seedPlaylist(service, admin, 3);
    await service.reorderLectures(ZARQA_OPP, { lecture_ids: [ids[1], ids[0], ids[2]] }, admin);
    const before = store.lectures.map((row) => `${row.provider_video_id}:${row.sort_order}`).sort();
    await youtube.applyPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID, import_all: true }, admin);
    const after = store.lectures.map((row) => `${row.provider_video_id}:${row.sort_order}`).sort();
    assert.deepEqual(after, before);
  });

  it('scenario E: unavailable videos warn without destroying LMS records', async () => {
    const videos = [
      videoItem(vid(1)),
      videoItem(vid(2), { privacyStatus: 'private', title: 'Private video' }),
      videoItem(vid(3)),
    ];
    const { service, youtube, store } = syncHarness(videos);
    await seedPlaylist(service, admin, 3);
    const preview = await youtube.previewPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID }, admin);
    assert.equal(preview.counts.unavailable, 1);
    const unavailable = preview.videos.find((row) => row.syncStatus === 'UNAVAILABLE');
    assert.equal(unavailable.lectureId != null, true);
    await youtube.applyPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID, import_all: true }, admin);
    assert.equal(store.lectures.length, 3);
  });

  it('repeated sync is idempotent and preserves relative order of new videos', async () => {
    const videos = [videoItem(vid(1)), videoItem(vid(2)), videoItem(vid(4)), videoItem(vid(7)), videoItem(vid(9))];
    const { service, youtube, store, audits } = syncHarness(videos);
    await seedPlaylist(service, admin, 2);
    const first = await youtube.applyPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID, import_all: true }, admin);
    assert.equal(first.summary.imported, 3);
    const second = await youtube.applyPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID, import_all: true }, admin);
    assert.equal(second.summary.imported, 0);
    const appended = store.lectures
      .filter((row) => [vid(4), vid(7), vid(9)].includes(row.provider_video_id))
      .sort((a, b) => a.sort_order - b.sort_order);
    assert.deepEqual(
      appended.map((row) => row.provider_video_id),
      [vid(4), vid(7), vid(9)]
    );
    assert.equal(audits.some((row) => row.actionType === 'RECORDED_LECTURE_PLAYLIST_SYNCED'), true);
  });

  it('classifies large playlists (10/50/51/100) without importing until confirmed', async () => {
    for (const size of [10, 50, 51, 100]) {
      const videos = Array.from({ length: size }, (_, i) => videoItem(vid(i + 1)));
      const { service, youtube, store } = syncHarness(videos);
      await seedPlaylist(service, admin, 1);
      const preview = await youtube.previewPlaylistSync(ZARQA_OPP, { playlist_id: PLAYLIST_ID }, admin);
      assert.equal(preview.counts.found, size);
      assert.equal(preview.counts.existing, 1);
      assert.equal(preview.counts.newCount, size - 1);
      assert.equal(store.lectures.length, 1);
    }
  });
});

describe('Recorded lectures phase 3 authorization and publication', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });

  it('denies reviewer mutation, students, cross-university admins, and institution roles', async () => {
    const { service } = createHarness();
    const [id] = await seedPlaylist(service, admin, 2);
    const reviewer = user({ roles: ['reviewer'], universityId: ZARQA_UNI });
    const listed = await service.listForStaff(ZARQA_OPP, reviewer);
    assert.equal(listed.lectures.length, 2);
    await assert.rejects(
      () => service.reorderLectures(ZARQA_OPP, { lecture_ids: listed.lectures.map((row) => row.id) }, reviewer),
      (err) => err.statusCode === 403
    );
    await assert.rejects(
      () => service.updateLecture(id, { title: 'Nope' }, user({ roles: ['student'], universityId: ZARQA_UNI })),
      (err) => err.statusCode === 403
    );
    await assert.rejects(
      () =>
        service.reorderLectures(TAFILA_OPP, { lecture_ids: [] }, user({ roles: ['admin'], universityId: ZARQA_UNI })),
      (err) => err.statusCode === 403
    );
    await assert.rejects(
      () =>
        service.listForStaff(
          ZARQA_OPP,
          user({ roles: ['admin'], universityId: ZARQA_UNI, organizationType: 'INSTITUTION' })
        ),
      (err) => err.statusCode === 403
    );
  });

  it('keeps DRAFT and HIDDEN off the student API while PUBLISHED remains visible', async () => {
    const { service } = createHarness();
    await seedPlaylist(service, admin, 3);
    const listed = await service.listForStudent(ZARQA_OPP, STUDENT_ZARQA);
    assert.equal(listed.lectures.length, 1);
    assert.equal(listed.lectures[0].title, 'Lecture 2');
  });
});

describe('Phase 3 architecture guards', () => {
  it('keeps reorder and sync on manage routes only and does not add a delete endpoint', () => {
    const recorded = read('src/modules/fieldTraining/fieldTraining.recordedLectures.routes.js');
    const academic = read('src/modules/fieldTraining/academicFieldTraining.routes.js');
    const student = read('src/modules/fieldTraining/studentFieldTraining.routes.js');
    const ui = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'src/pages/admin/fieldTraining/components/manage/RecordedLecturesSortableList.jsx'),
      'utf8'
    );
    assert.match(recorded, /recorded-lectures\/reorder/);
    assert.match(recorded, /playlist\/sync\/preview/);
    assert.equal(/router\.delete\(\s*'\/recorded-lectures/.test(recorded), false);
    assert.equal(/reorder/.test(academic), false);
    assert.equal(/playlist\/sync/.test(student), false);
    assert.match(ui, /@dnd-kit\/core/);
    assert.match(ui, /GripVertical/);
    assert.equal(/watchCount|completionPercentage|watchedMinutes/.test(ui), false);
  });
});
