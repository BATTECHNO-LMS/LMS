'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../src/utils/apiError');
const lectureMappers = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');
const { parseIso8601Duration } = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.iso8601Duration');
const {
  parseYoutubeVideoInput,
  parseYoutubePlaylistInput,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeUrls');
const {
  createYoutubeClient,
  normalizeVideoMetadata,
  pickThumbnail,
  API_BASE,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeClient');
const {
  createYoutubeImportService,
  nextImportSortStart,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeImport.service');

const ROOT = path.join(__dirname, '..');
const FRONTEND_ROOT = path.join(ROOT, '..', 'frontend');
const ZARQA_UNI = '4b85f423-c543-499e-9765-a5248dbfa583';
const TAFILA_UNI = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZARQA_OPP = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const VIDEO_ID = 'dQw4w9WgXcQ';
const PLAYLIST_ID = 'PLtestPlay01';
const FAKE_KEY = 'test-youtube-key-do-not-log';

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

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function videoItem(id, overrides = {}) {
  const thumbnails = {
    default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` },
    medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
    high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
  };
  if (overrides.maxres !== false) {
    thumbnails.maxres = { url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` };
  }
  return {
    id,
    snippet: {
      title: overrides.title || `Title ${id}`,
      description: overrides.description || `Description ${id}`,
      thumbnails,
    },
    contentDetails: { duration: overrides.duration || 'PT1M' },
    status: {
      privacyStatus: overrides.privacyStatus || 'public',
      uploadStatus: overrides.uploadStatus || 'processed',
    },
  };
}

function playlistEntry(videoId, position, title) {
  return {
    snippet: {
      position,
      title: title || `Item ${videoId}`,
      resourceId: { kind: 'youtube#video', videoId },
    },
    contentDetails: { videoId },
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
    lectures: [],
  };
}

function createLectureRepo(store) {
  return {
    mapLectureRow: lectureMappers.mapLectureRow,
    async listYoutubeVideoIds(opportunityId) {
      return new Set(
        store.lectures
          .filter((row) => row.opportunity_id === opportunityId && row.provider === 'youtube')
          .map((row) => row.provider_video_id)
      );
    },
    async findMaxSortOrder(opportunityId) {
      const rows = store.lectures.filter((row) => row.opportunity_id === opportunityId);
      if (!rows.length) return null;
      return Math.max(...rows.map((row) => row.sort_order));
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
        err.meta = { target: ['opportunity_id', 'provider', 'provider_video_id'] };
        throw err;
      }
      const row = {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
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
  };
}

function createImportHarness({ youtubeClient, store = makeStore() } = {}) {
  const lectureRepo = createLectureRepo(store);
  const ftRepo = {
    async findById(id) {
      return store.opportunities.find((row) => row.id === id) || null;
    },
  };
  const audits = [];
  const service = createYoutubeImportService({
    lectureRepo,
    ftRepo,
    youtubeClient,
    recordAudit: async (payload) => {
      audits.push(payload);
    },
    maxPlaylistItems: 400,
  });
  return { store, service, audits, lectureRepo };
}

function createCatalogClient({
  playlistId = PLAYLIST_ID,
  playlistTitle = 'Full Stack Training',
  videos = [],
} = {}) {
  const byId = new Map(videos.map((item) => [item.id, item]));
  const items = videos.map((item, index) =>
    playlistEntry(item.id, item.playlistPosition ?? index, item.snippet?.title)
  );
  const stats = { playlistItemsCalls: 0, videosListCalls: 0, playlistsListCalls: 0 };
  return {
    stats,
    async getVideo(id) {
      stats.videosListCalls += 1;
      return byId.get(id) || null;
    },
    async getVideos(ids) {
      stats.videosListCalls += 1;
      const map = new Map();
      for (const id of ids) {
        if (byId.has(id)) map.set(id, byId.get(id));
      }
      return map;
    },
    async getPlaylist(id) {
      stats.playlistsListCalls += 1;
      if (id !== playlistId) return null;
      return { id, snippet: { title: playlistTitle } };
    },
    async listPlaylistItems(id) {
      stats.playlistItemsCalls += 1;
      if (id !== playlistId) return { items: [], totalResults: 0 };
      return { items, totalResults: items.length };
    },
  };
}

function createFetchMock({ videos = {}, playlists = {}, playlistPages = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    calls.push({
      href: parsed.origin + parsed.pathname,
      resource: parsed.pathname.split('/').pop(),
      ids: parsed.searchParams.get('id'),
      playlistId: parsed.searchParams.get('playlistId'),
      pageToken: parsed.searchParams.get('pageToken') || '',
      key: parsed.searchParams.get('key'),
    });
    if (parsed.origin !== 'https://www.googleapis.com' || !parsed.pathname.startsWith('/youtube/v3/')) {
      throw new Error(`SSRF_BLOCKED:${parsed.origin}${parsed.pathname}`);
    }
    const resource = parsed.pathname.split('/').pop();
    if (resource === 'videos') {
      const ids = String(parsed.searchParams.get('id') || '')
        .split(',')
        .filter(Boolean);
      return jsonResponse(200, { items: ids.map((id) => videos[id]).filter(Boolean) });
    }
    if (resource === 'playlists') {
      const id = parsed.searchParams.get('id');
      const item = playlists[id];
      return jsonResponse(200, { items: item ? [item] : [] });
    }
    if (resource === 'playlistItems') {
      const token = parsed.searchParams.get('pageToken') || '';
      const page = playlistPages.find((entry) => (entry.pageToken || '') === token);
      if (!page) return jsonResponse(404, { error: { errors: [{ reason: 'playlistNotFound' }] } });
      return jsonResponse(200, {
        items: page.items,
        nextPageToken: page.nextPageToken || undefined,
        pageInfo: { totalResults: page.totalResults ?? page.items.length },
      });
    }
    return jsonResponse(404, { error: { errors: [{ reason: 'notFound' }] } });
  };
  return { fetchImpl, calls };
}

describe('ISO-8601 YouTube duration parser', () => {
  it('converts common YouTube durations to whole seconds', () => {
    assert.equal(parseIso8601Duration('PT45S'), 45);
    assert.equal(parseIso8601Duration('PT12M8S'), 728);
    assert.equal(parseIso8601Duration('PT1H3M20S'), 3800);
    assert.equal(parseIso8601Duration('PT2H'), 7200);
    assert.equal(parseIso8601Duration('PT1H12M35S'), 4355);
  });

  it('rejects malformed values without string replacement tricks', () => {
    assert.equal(parseIso8601Duration('1H12M'), null);
    assert.equal(parseIso8601Duration('PT'), 0);
    assert.equal(parseIso8601Duration(''), null);
  });
});

describe('YouTube URL parsing and SSRF guards', () => {
  it('extracts video ids from common watch, short, and embed URLs', () => {
    assert.equal(parseYoutubeVideoInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ').videoId, VIDEO_ID);
    assert.equal(parseYoutubeVideoInput('https://youtu.be/dQw4w9WgXcQ').videoId, VIDEO_ID);
    assert.equal(parseYoutubeVideoInput('https://www.youtube.com/embed/dQw4w9WgXcQ').videoId, VIDEO_ID);
  });

  it('extracts playlist ids from playlist URLs and watch URLs that also contain list=', () => {
    const playlistUrl = parseYoutubePlaylistInput(
      `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`
    );
    assert.equal(playlistUrl.playlistId, PLAYLIST_ID);
    const mixed = `https://www.youtube.com/watch?v=${VIDEO_ID}&list=${PLAYLIST_ID}`;
    assert.equal(parseYoutubeVideoInput(mixed).videoId, VIDEO_ID);
    assert.equal(parseYoutubePlaylistInput(mixed).playlistId, PLAYLIST_ID);
  });

  it('rejects malformed URLs and SSRF-like hosts without fetching them', () => {
    const bad = [
      'not-a-url',
      'https://evil.example/watch?v=dQw4w9WgXcQ',
      'http://127.0.0.1/watch?v=dQw4w9WgXcQ',
      'http://localhost/watch?v=dQw4w9WgXcQ',
      'http://169.254.169.254/latest/meta-data',
      'https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'file:///etc/passwd',
    ];
    for (const value of bad) {
      assert.throws(
        () => parseYoutubeVideoInput(value),
        (err) => err instanceof ApiError && err.statusCode === 400 && err.message === 'رابط YouTube غير صالح.'
      );
    }
  });
});

describe('YouTube Data API client', () => {
  it('pages playlistItems.list until nextPageToken is exhausted (50+50+23)', async () => {
    const videos = {};
    const pages = [
      {
        pageToken: '',
        nextPageToken: 'p2',
        totalResults: 123,
        items: Array.from({ length: 50 }, (_, i) => playlistEntry(vid(i + 1), i)),
      },
      {
        pageToken: 'p2',
        nextPageToken: 'p3',
        totalResults: 123,
        items: Array.from({ length: 50 }, (_, i) => playlistEntry(vid(i + 51), i + 50)),
      },
      {
        pageToken: 'p3',
        totalResults: 123,
        items: Array.from({ length: 23 }, (_, i) => playlistEntry(vid(i + 101), i + 100)),
      },
    ];
    for (let i = 1; i <= 123; i += 1) videos[vid(i)] = videoItem(vid(i));
    const { fetchImpl, calls } = createFetchMock({
      videos,
      playlists: { [PLAYLIST_ID]: { id: PLAYLIST_ID, snippet: { title: 'Paginated' } } },
      playlistPages: pages,
    });
    const client = createYoutubeClient({
      fetchImpl,
      getApiKey: () => FAKE_KEY,
      maxAttempts: 1,
    });
    const listed = await client.listPlaylistItems(PLAYLIST_ID);
    assert.equal(listed.items.length, 123);
    assert.equal(client.stats.playlistItemsCalls, 3);
    const ids = listed.items.map((item) => item.contentDetails.videoId);
    const metadata = await client.getVideos(ids);
    assert.equal(metadata.size, 123);
    assert.equal(client.stats.videosListCalls, 3);
    assert.equal(calls.filter((c) => c.resource === 'videos').length, 3);
    assert.ok(calls.every((c) => c.href.startsWith(API_BASE)));
    assert.ok(calls.every((c) => c.key === FAKE_KEY));
  });

  it('batches 51 video ids into two videos.list calls, not 51', async () => {
    const videos = {};
    for (let i = 1; i <= 51; i += 1) videos[vid(i)] = videoItem(vid(i));
    const { fetchImpl, calls } = createFetchMock({ videos });
    const client = createYoutubeClient({
      fetchImpl,
      getApiKey: () => FAKE_KEY,
      maxAttempts: 1,
    });
    const metadata = await client.getVideos(Array.from({ length: 51 }, (_, i) => vid(i + 1)));
    assert.equal(metadata.size, 51);
    assert.equal(client.stats.videosListCalls, 2);
    assert.equal(calls.filter((c) => c.resource === 'videos').length, 2);
    assert.ok(calls[0].ids.split(',').length <= 50);
  });

  it('does not retry 400/403/404 and maps quota/key errors to Arabic admin messages', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(403, { error: { errors: [{ reason: 'quotaExceeded' }] } });
    };
    const client = createYoutubeClient({
      fetchImpl,
      getApiKey: () => FAKE_KEY,
      maxAttempts: 3,
    });
    await assert.rejects(
      () => client.getVideo(VIDEO_ID),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 503 &&
        err.message === 'تم تجاوز الحد المتاح لخدمة YouTube مؤقتًا.'
    );
    assert.equal(calls, 1);
  });

  it('fails closed when the API key is missing', async () => {
    const client = createYoutubeClient({
      fetchImpl: async () => {
        throw new Error('should not fetch');
      },
      getApiKey: () => '',
    });
    await assert.rejects(
      () => client.getVideo(VIDEO_ID),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 503 &&
        err.message === 'خدمة YouTube غير مهيأة على الخادم. تواصل مع مدير النظام.'
    );
  });

  it('errors instead of truncating playlists larger than the configured maximum', async () => {
    const { fetchImpl } = createFetchMock({
      playlistPages: [
        {
          pageToken: '',
          nextPageToken: 'p2',
          totalResults: 401,
          items: Array.from({ length: 50 }, (_, i) => playlistEntry(vid(i + 1), i)),
        },
      ],
    });
    const client = createYoutubeClient({
      fetchImpl,
      getApiKey: () => FAKE_KEY,
      maxAttempts: 1,
    });
    await assert.rejects(
      () => client.listPlaylistItems(PLAYLIST_ID, { maxItems: 400 }),
      (err) => err instanceof ApiError && err.code === 'YOUTUBE_PLAYLIST_TOO_LARGE'
    );
  });
});

describe('YouTube metadata normalization', () => {
  it('stores duration in seconds and prefers the highest thumbnail', () => {
    const meta = normalizeVideoMetadata(
      videoItem(VIDEO_ID, { duration: 'PT1H12M35S', title: 'مقدمة في التدريب' })
    );
    assert.equal(meta.providerVideoId, VIDEO_ID);
    assert.equal(meta.durationSeconds, 4355);
    assert.equal(meta.thumbnailUrl, `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`);
    assert.equal(meta.available, true);
    assert.equal(pickThumbnail({ high: { url: 'h' }, maxres: { url: 'm' } }), 'm');
  });

  it('treats unlisted videos as importable and private/deleted as unavailable', () => {
    const unlisted = normalizeVideoMetadata(videoItem('unlisted0001', { privacyStatus: 'unlisted' }));
    assert.equal(unlisted.available, true);
    const priv = normalizeVideoMetadata(videoItem('private00001', { privacyStatus: 'private' }));
    assert.equal(priv.available, false);
    const deleted = normalizeVideoMetadata(videoItem('deleted00001', { title: 'Deleted video' }));
    assert.equal(deleted.available, false);
  });
});

describe('YouTube single video preview and import', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
  const url = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

  it('previews metadata without saving, then imports as DRAFT after revalidation', async () => {
    const youtubeClient = createCatalogClient({
      videos: [videoItem(VIDEO_ID, { duration: 'PT1H12M35S', title: 'مقدمة في التدريب' })],
    });
    const { service, store, audits } = createImportHarness({ youtubeClient });
    const preview = await service.previewSingle(ZARQA_OPP, { url }, admin);
    assert.equal(store.lectures.length, 0);
    assert.equal(preview.preview.provider, 'YOUTUBE');
    assert.equal(preview.preview.providerVideoId, VIDEO_ID);
    assert.equal(preview.preview.durationSeconds, 4355);
    assert.equal(preview.preview.duplicateStatus, 'NEW');

    const imported = await service.importSingle(ZARQA_OPP, { url }, admin);
    assert.equal(imported.lecture.status, 'DRAFT');
    assert.equal(imported.lecture.provider, 'YOUTUBE');
    assert.equal(imported.lecture.provider_video_id, VIDEO_ID);
    assert.equal(imported.lecture.source_type, 'SINGLE');
    assert.equal(imported.lecture.source_playlist_id, null);
    assert.equal(imported.lecture.duration_seconds, 4355);
    assert.equal(imported.lecture.sort_order, 1);
    assert.equal(store.lectures[0].status, 'draft');
    assert.equal(audits[0].actionType, 'RECORDED_LECTURE_IMPORTED_SINGLE');
    assert.equal(JSON.stringify(audits).includes(FAKE_KEY), false);
  });

  it('rejects invalid URLs, unavailable videos, and duplicates', async () => {
    const youtubeClient = createCatalogClient({ videos: [videoItem(VIDEO_ID)] });
    const { service } = createImportHarness({ youtubeClient });
    await assert.rejects(
      () => service.previewSingle(ZARQA_OPP, { url: 'https://evil.example/watch?v=dQw4w9WgXcQ' }, admin),
      (err) => err.message === 'رابط YouTube غير صالح.'
    );
    await assert.rejects(
      () => service.previewSingle(ZARQA_OPP, { url: 'https://youtu.be/zzzzzzzzzzz' }, admin),
      (err) => err.message === 'تعذر العثور على الفيديو أو الوصول إليه.'
    );
    await service.importSingle(ZARQA_OPP, { url }, admin);
    await assert.rejects(
      () => service.importSingle(ZARQA_OPP, { url }, admin),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 409 &&
        err.message === 'هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية.'
    );
  });
});

describe('YouTube playlist preview and import', () => {
  const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
  const playlistUrl = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

  function catalogVideos(count, extras = []) {
    const videos = Array.from({ length: count }, (_, i) =>
      videoItem(vid(i + 1), { title: `Lecture ${i + 1}`, duration: 'PT12M8S' })
    );
    return videos.concat(extras);
  }

  it('previews playlist items with duplicate/unavailable classification and does not import yet', async () => {
    const videos = catalogVideos(3);
    videos.push(videoItem(vid(4), { privacyStatus: 'private', title: 'Private video' }));
    const youtubeClient = createCatalogClient({ videos });
    const { service, store } = createImportHarness({ youtubeClient });
    await service.importSingle(ZARQA_OPP, { url: `https://youtu.be/${vid(2)}` }, admin);
    const preview = await service.previewPlaylist(ZARQA_OPP, { url: playlistUrl }, admin);
    assert.equal(store.lectures.length, 1);
    assert.equal(preview.playlist.title, 'Full Stack Training');
    assert.equal(preview.counts.found, 4);
    assert.equal(preview.counts.duplicate, 1);
    assert.equal(preview.counts.unavailable, 1);
    assert.equal(preview.counts.newCount, 2);
    assert.equal(preview.videos[1].duplicateStatus, 'ALREADY_IMPORTED');
    assert.equal(preview.videos[3].availability, 'UNAVAILABLE');
  });

  it('imports all new videos after existing sortOrder and preserves playlist relative order', async () => {
    const youtubeClient = createCatalogClient({ videos: catalogVideos(3) });
    const { service, store } = createImportHarness({ youtubeClient });
    store.lectures.push({
      id: crypto.randomUUID(),
      opportunity_id: ZARQA_OPP,
      provider: 'youtube',
      provider_video_id: 'existing000',
      sort_order: 5,
      status: 'draft',
    });
    const result = await service.importPlaylist(
      ZARQA_OPP,
      { url: playlistUrl, import_all: true },
      admin
    );
    assert.equal(result.summary.imported, 3);
    assert.equal(result.summary.found, 3);
    const imported = store.lectures
      .filter((row) => row.provider_video_id !== 'existing000')
      .sort((a, b) => a.sort_order - b.sort_order);
    assert.deepEqual(
      imported.map((row) => row.provider_video_id),
      [vid(1), vid(2), vid(3)]
    );
    assert.deepEqual(
      imported.map((row) => row.sort_order),
      [6, 7, 8]
    );
    assert.ok(imported.every((row) => row.status === 'draft'));
    assert.ok(imported.every((row) => row.source_type === 'playlist'));
    assert.ok(imported.every((row) => row.source_playlist_id === PLAYLIST_ID));
  });

  it('selectively imports chosen ids in playlist order, not title order', async () => {
    const videos = [
      videoItem(vid(1), { title: 'Zed' }),
      videoItem(vid(2), { title: 'Alpha' }),
      videoItem(vid(3), { title: 'Middle' }),
      videoItem(vid(4), { title: 'Beta' }),
      videoItem(vid(5), { title: 'Omega' }),
    ];
    const youtubeClient = createCatalogClient({ videos });
    const { service, store } = createImportHarness({ youtubeClient });
    const result = await service.importPlaylist(
      ZARQA_OPP,
      { url: playlistUrl, video_ids: [vid(5), vid(2), vid(4)] },
      admin
    );
    assert.equal(result.summary.selected, 3);
    assert.equal(result.summary.imported, 3);
    assert.deepEqual(
      store.lectures.map((row) => row.provider_video_id),
      [vid(2), vid(4), vid(5)]
    );
    assert.deepEqual(
      store.lectures.map((row) => row.sort_order),
      [1, 2, 3]
    );
  });

  it('skips unavailable items, is idempotent on repeat import, and does not duplicate concurrently', async () => {
    const videos = catalogVideos(4, [videoItem(vid(5), { privacyStatus: 'private', title: 'Private video' })]);
    const youtubeClient = createCatalogClient({ videos });
    const { service, store, audits } = createImportHarness({ youtubeClient });
    const raced = createImportHarness({ youtubeClient });
    const [left, right] = await Promise.all([
      raced.service.importPlaylist(ZARQA_OPP, { url: playlistUrl, import_all: true }, admin),
      raced.service.importPlaylist(ZARQA_OPP, { url: playlistUrl, import_all: true }, admin),
    ]);
    assert.equal(raced.store.lectures.length, 4);
    assert.equal(left.summary.imported + right.summary.imported, 4);

    const first = await service.importPlaylist(ZARQA_OPP, { url: playlistUrl, import_all: true }, admin);
    assert.equal(first.summary.imported, 4);
    assert.equal(first.summary.unavailable, 1);
    const second = await service.importPlaylist(ZARQA_OPP, { url: playlistUrl, import_all: true }, admin);
    assert.equal(second.summary.imported, 0);
    assert.equal(second.summary.alreadyExisting, 4);
    assert.equal(store.lectures.length, 4);
    assert.equal(audits.some((row) => row.actionType === 'RECORDED_LECTURES_IMPORTED_PLAYLIST'), true);
  });

  it('starts empty-opportunity playlist imports at sortOrder 1', () => {
    assert.equal(nextImportSortStart(null), 1);
    assert.equal(nextImportSortStart(5), 6);
  });
});

describe('YouTube import authorization', () => {
  const youtubeClient = createCatalogClient({ videos: [videoItem(VIDEO_ID)] });
  const url = `https://youtu.be/${VIDEO_ID}`;

  it('denies reviewer mutation, students, cross-university admins, and institution roles', async () => {
    const { service } = createImportHarness({ youtubeClient });
    await assert.rejects(
      () =>
        service.previewSingle(ZARQA_OPP, { url }, user({ roles: ['reviewer'], universityId: ZARQA_UNI })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    await assert.rejects(
      () =>
        service.importSingle(ZARQA_OPP, { url }, user({ roles: ['student'], universityId: ZARQA_UNI })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    await assert.rejects(
      () =>
        service.importSingle(TAFILA_OPP, { url }, user({ roles: ['admin'], universityId: ZARQA_UNI })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    await assert.rejects(
      () =>
        service.importSingle(
          ZARQA_OPP,
          { url },
          user({ roles: ['admin'], universityId: ZARQA_UNI, organizationType: 'INSTITUTION' })
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('allows a university admin for their own opportunity', async () => {
    const { service } = createImportHarness({ youtubeClient });
    const preview = await service.previewSingle(
      ZARQA_OPP,
      { url },
      user({ roles: ['admin'], universityId: ZARQA_UNI })
    );
    assert.equal(preview.preview.providerVideoId, VIDEO_ID);
  });
});

describe('Phase 2 architecture guards', () => {
  it('keeps YouTube Data API calls on the backend and never exposes the key to the browser', () => {
    const frontendService = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'src/features/fieldTraining/fieldTraining.service.js'),
      'utf8'
    );
    const frontendSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'src/pages/admin/fieldTraining/components/manage/ManageRecordedLecturesTab.jsx'),
      'utf8'
    );
    const clientSrc = read('src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeClient.js');
    const importSrc = read('src/modules/fieldTraining/fieldTraining.recordedLectures.youtubeImport.service.js');
    const envExample = read('.env.example');
    assert.match(frontendService, /recorded-lectures\/youtube\/preview/);
    assert.equal(/googleapis\.com\/youtube/.test(frontendService), false);
    assert.equal(/YOUTUBE_API_KEY/.test(frontendService), false);
    assert.equal(/googleapis\.com\/youtube/.test(frontendSrc), false);
    assert.match(clientSrc, /https:\/\/www\.googleapis\.com/);
    assert.match(clientSrc, /\/youtube\/v3/);
    assert.match(envExample, /YOUTUBE_API_KEY=/);
    assert.match(importSrc, /STATUSES\.DRAFT/);
    assert.equal(/FieldTrainingRecordedLectureSource/.test(importSrc), false);
    assert.equal(/log\([^)]*url/.test(clientSrc.replace(/\s+/g, ' ')), false);
  });

  it('covers representative playlist sizes without an N+1 videos.list pattern', async () => {
    for (const size of [1, 10, 50, 51, 100, 123]) {
      const videos = {};
      const items = [];
      for (let i = 1; i <= size; i += 1) {
        videos[vid(i)] = videoItem(vid(i));
        items.push(playlistEntry(vid(i), i - 1));
      }
      const pages = [];
      for (let offset = 0; offset < items.length; offset += 50) {
        const slice = items.slice(offset, offset + 50);
        pages.push({
          pageToken: offset === 0 ? '' : `p${offset}`,
          nextPageToken: offset + 50 < items.length ? `p${offset + 50}` : undefined,
          totalResults: size,
          items: slice,
        });
      }
      const { fetchImpl, calls } = createFetchMock({
        videos,
        playlists: { [PLAYLIST_ID]: { id: PLAYLIST_ID, snippet: { title: `Size ${size}` } } },
        playlistPages: pages,
      });
      const client = createYoutubeClient({ fetchImpl, getApiKey: () => FAKE_KEY, maxAttempts: 1 });
      const listed = await client.listPlaylistItems(PLAYLIST_ID);
      const metadata = await client.getVideos(listed.items.map((item) => item.contentDetails.videoId));
      assert.equal(listed.items.length, size);
      assert.equal(metadata.size, size);
      const videoCalls = calls.filter((c) => c.resource === 'videos').length;
      assert.equal(videoCalls, Math.ceil(size / 50));
      assert.ok(videoCalls < size || size === 1);
    }
  });
});
