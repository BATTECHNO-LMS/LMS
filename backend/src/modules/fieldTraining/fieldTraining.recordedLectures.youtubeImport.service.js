'use strict';

const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { recordAudit: defaultRecordAudit } = require('../../utils/auditRecorder');
const { log } = require('../../utils/logger');
const ftRepoDefault = require('./fieldTraining.repository');
const lectureRepoDefault = require('./fieldTraining.recordedLectures.repository');
const access = require('./fieldTraining.access');
const {
  PROVIDERS,
  SOURCE_TYPES,
  STATUSES,
  AUDIT,
  MSG,
} = require('./fieldTraining.recordedLectures.constants');
const {
  parseYoutubeVideoInput,
  parseYoutubePlaylistInput,
  normalizedPlaylistUrl,
} = require('./fieldTraining.recordedLectures.youtubeUrls');
const {
  createYoutubeClient,
  normalizeVideoMetadata,
} = require('./fieldTraining.recordedLectures.youtubeClient');

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 8000;
const AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
});
const DUPLICATE = Object.freeze({
  NEW: 'NEW',
  ALREADY_IMPORTED: 'ALREADY_IMPORTED',
  UNAVAILABLE: 'UNAVAILABLE',
});
const SYNC = Object.freeze({
  EXISTING: 'EXISTING',
  NEW: 'NEW',
  UNAVAILABLE: 'UNAVAILABLE',
  REMOVED_FROM_SOURCE: 'REMOVED_FROM_SOURCE',
});

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function mapDuplicateError(err) {
  if (err?.code !== 'P2002') return null;
  return new ApiError(409, MSG.duplicate, null, 'RECORDED_LECTURE_DUPLICATE');
}

function nextImportSortStart(maxSort) {
  if (maxSort == null) return 1;
  return maxSort + 1;
}

function classifyVideo(meta, existingIds, seenInPreview) {
  if (!meta?.available) {
    return {
      availability: AVAILABILITY.UNAVAILABLE,
      duplicateStatus: DUPLICATE.UNAVAILABLE,
    };
  }
  if (existingIds.has(meta.providerVideoId) || seenInPreview.has(meta.providerVideoId)) {
    return {
      availability: AVAILABILITY.AVAILABLE,
      duplicateStatus: DUPLICATE.ALREADY_IMPORTED,
    };
  }
  seenInPreview.add(meta.providerVideoId);
  return {
    availability: AVAILABILITY.AVAILABLE,
    duplicateStatus: DUPLICATE.NEW,
  };
}

function toPreviewItem(meta, classification, playlistPosition) {
  return {
    provider: 'YOUTUBE',
    providerVideoId: meta?.providerVideoId || null,
    title: meta?.available ? meta.title : 'فيديو غير متاح',
    thumbnailUrl: meta?.thumbnailUrl || null,
    durationSeconds: meta?.durationSeconds ?? null,
    playlistPosition: playlistPosition ?? meta?.playlistPosition ?? null,
    availability: classification.availability,
    duplicateStatus: classification.duplicateStatus,
    privacyStatus: meta?.privacyStatus || null,
  };
}

function createYoutubeImportService(deps = {}) {
  const lectureRepo = deps.lectureRepo || lectureRepoDefault;
  const ftRepo = deps.ftRepo || ftRepoDefault;
  const recordAudit = deps.recordAudit || defaultRecordAudit;
  const youtube = deps.youtubeClient || createYoutubeClient(deps.youtube || {});
  const maxPlaylistItems = deps.maxPlaylistItems || env.YOUTUBE_PLAYLIST_MAX_ITEMS || 400;

  async function assertManage(opportunityId, user) {
    const opp = await ftRepo.findById(opportunityId);
    if (!opp) throw new ApiError(404, MSG.opportunityNotFound, null, 'OPPORTUNITY_NOT_FOUND');
    await access.assertRecordedLectureManageAccess(user, opp);
    return opp;
  }

  async function previewSingle(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const parsed = parseYoutubeVideoInput(body.url);
    const item = await youtube.getVideo(parsed.videoId);
    const meta = normalizeVideoMetadata(item);
    if (!meta?.available) {
      throw new ApiError(404, MSG.youtubeVideoUnavailable, null, 'YOUTUBE_VIDEO_UNAVAILABLE');
    }
    const existing = await lectureRepo.listYoutubeVideoIds(opportunityId);
    const classification = classifyVideo(meta, existing, new Set());
    log('info', 'recorded_lectures.youtube.preview_single', {
      provider: 'youtube',
      operation: 'preview_single',
      videoCount: 1,
      durationMs: Date.now() - started,
      success: true,
    });
    return {
      preview: toPreviewItem(meta, classification, null),
    };
  }

  async function importSingle(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const parsed = parseYoutubeVideoInput(body.url);
    const item = await youtube.getVideo(parsed.videoId);
    const meta = normalizeVideoMetadata(item);
    if (!meta?.available) {
      throw new ApiError(404, MSG.youtubeVideoUnavailable, null, 'YOUTUBE_VIDEO_UNAVAILABLE');
    }
    const existing = await lectureRepo.listYoutubeVideoIds(opportunityId);
    if (existing.has(meta.providerVideoId)) {
      throw new ApiError(409, MSG.duplicate, null, 'RECORDED_LECTURE_DUPLICATE');
    }
    const maxSort = await lectureRepo.findMaxSortOrder(opportunityId);
    const sortOrder = nextImportSortStart(maxSort);
    let row;
    try {
      row = await lectureRepo.createLecture({
        opportunity_id: opportunityId,
        session_id: null,
        provider: PROVIDERS.YOUTUBE,
        provider_video_id: meta.providerVideoId,
        source_type: SOURCE_TYPES.SINGLE,
        source_playlist_id: null,
        source_playlist_url: null,
        title: clip(meta.title, TITLE_MAX) || meta.providerVideoId,
        description: clip(meta.description, DESCRIPTION_MAX),
        thumbnail_url: meta.thumbnailUrl,
        duration_seconds: meta.durationSeconds,
        lecture_date: null,
        instructor_name: null,
        sort_order: sortOrder,
        status: STATUSES.DRAFT,
        published_at: null,
        created_by_id: user?.userId ?? null,
      });
    } catch (err) {
      const mapped = mapDuplicateError(err);
      if (mapped) throw mapped;
      throw err;
    }
    await recordAudit({
      userId: user?.userId ?? null,
      universityId: user?.universityId ?? null,
      actionType: AUDIT.IMPORTED_SINGLE,
      entityType: 'field_training_recorded_lecture',
      entityId: row.id,
      newValues: {
        opportunityId,
        provider: 'youtube',
        count: 1,
      },
    });
    log('info', 'recorded_lectures.youtube.import_single', {
      provider: 'youtube',
      operation: 'import_single',
      videoCount: 1,
      durationMs: Date.now() - started,
      success: true,
    });
    return {
      lecture: lectureRepo.mapLectureRow(row),
      summary: { imported: 1, alreadyExisting: 0, unavailable: 0 },
    };
  }

  async function loadPlaylistCatalog(playlistId) {
    const playlist = await youtube.getPlaylist(playlistId);
    if (!playlist) {
      throw new ApiError(404, MSG.youtubePlaylistUnavailable, null, 'YOUTUBE_PLAYLIST_UNAVAILABLE');
    }
    const { items, totalResults } = await youtube.listPlaylistItems(playlistId, {
      maxItems: maxPlaylistItems,
    });
    const playlistTitle = String(playlist.snippet?.title || '').trim() || null;
    const ordered = [];
    const ids = [];
    items.forEach((entry, index) => {
      const videoId = entry.contentDetails?.videoId || entry.snippet?.resourceId?.videoId || null;
      const position =
        Number.isFinite(Number(entry.snippet?.position)) ? Number(entry.snippet.position) : index;
      ordered.push({
        videoId,
        playlistPosition: position,
        snippetTitle: String(entry.snippet?.title || '').trim(),
      });
      if (videoId) ids.push(videoId);
    });
    const metadataById = await youtube.getVideos(ids);
    return { playlistTitle, totalResults, ordered, metadataById };
  }

  function buildPlaylistPreviewItems(catalog, existingIds) {
    const seen = new Set();
    const videos = catalog.ordered.map((entry) => {
      if (!entry.videoId) {
        return toPreviewItem(
          { providerVideoId: null, title: 'فيديو غير متاح', available: false },
          { availability: AVAILABILITY.UNAVAILABLE, duplicateStatus: DUPLICATE.UNAVAILABLE },
          entry.playlistPosition
        );
      }
      const raw = catalog.metadataById.get(entry.videoId);
      const meta = normalizeVideoMetadata(raw, { playlistPosition: entry.playlistPosition });
      if (!meta) {
        return toPreviewItem(
          {
            providerVideoId: entry.videoId,
            title: entry.snippetTitle || 'فيديو غير متاح',
            available: false,
          },
          { availability: AVAILABILITY.UNAVAILABLE, duplicateStatus: DUPLICATE.UNAVAILABLE },
          entry.playlistPosition
        );
      }
      const classification = classifyVideo(meta, existingIds, seen);
      return toPreviewItem(meta, classification, entry.playlistPosition);
    });
    videos.sort((a, b) => (a.playlistPosition ?? 0) - (b.playlistPosition ?? 0));
    return videos;
  }

  function summarizePreview(videos) {
    return {
      found: videos.length,
      valid: videos.filter((v) => v.availability === AVAILABILITY.AVAILABLE).length,
      duplicate: videos.filter((v) => v.duplicateStatus === DUPLICATE.ALREADY_IMPORTED).length,
      unavailable: videos.filter((v) => v.availability === AVAILABILITY.UNAVAILABLE).length,
      newCount: videos.filter((v) => v.duplicateStatus === DUPLICATE.NEW).length,
    };
  }

  async function previewPlaylist(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const parsed = parseYoutubePlaylistInput(body.url);
    const catalog = await loadPlaylistCatalog(parsed.playlistId);
    const existing = await lectureRepo.listYoutubeVideoIds(opportunityId);
    const videos = buildPlaylistPreviewItems(catalog, existing);
    const counts = summarizePreview(videos);
    if (!videos.length || counts.valid === 0) {
      throw new ApiError(400, MSG.youtubePlaylistEmpty, null, 'YOUTUBE_PLAYLIST_EMPTY');
    }
    log('info', 'recorded_lectures.youtube.preview_playlist', {
      provider: 'youtube',
      operation: 'preview_playlist',
      videoCount: videos.length,
      durationMs: Date.now() - started,
      success: true,
    });
    return {
      playlist: {
        provider: 'YOUTUBE',
        playlistId: parsed.playlistId,
        playlistUrl: normalizedPlaylistUrl(parsed.playlistId),
        title: catalog.playlistTitle,
      },
      counts,
      videos,
    };
  }

  async function importPlaylist(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const parsed = parseYoutubePlaylistInput(body.url);
    const catalog = await loadPlaylistCatalog(parsed.playlistId);
    const existing = await lectureRepo.listYoutubeVideoIds(opportunityId);
    const videos = buildPlaylistPreviewItems(catalog, existing);
    const counts = summarizePreview(videos);
    if (!videos.length) {
      throw new ApiError(400, MSG.youtubePlaylistEmpty, null, 'YOUTUBE_PLAYLIST_EMPTY');
    }

    const importAll = body.import_all === true || body.importAll === true;
    const requested = Array.isArray(body.video_ids)
      ? body.video_ids
      : Array.isArray(body.videoIds)
        ? body.videoIds
        : [];
    const requestedSet = new Set(requested.map((id) => String(id || '').trim()).filter(Boolean));
    if (!importAll && requestedSet.size === 0) {
      throw new ApiError(400, MSG.youtubeSelectionRequired, null, 'YOUTUBE_IMPORT_SELECTION_REQUIRED');
    }
    const chosen = videos
      .filter((video) => {
        if (video.duplicateStatus !== DUPLICATE.NEW) return false;
        return importAll || requestedSet.has(video.providerVideoId);
      })
      .sort((a, b) => (a.playlistPosition ?? 0) - (b.playlistPosition ?? 0));

    const maxSort = await lectureRepo.findMaxSortOrder(opportunityId);
    let sortOrder = nextImportSortStart(maxSort);
    const metaById = catalog.metadataById;
    const rows = chosen.map((video) => {
      const raw = metaById.get(video.providerVideoId);
      const meta = normalizeVideoMetadata(raw, { playlistPosition: video.playlistPosition });
      const row = {
        opportunity_id: opportunityId,
        session_id: null,
        provider: PROVIDERS.YOUTUBE,
        provider_video_id: video.providerVideoId,
        source_type: SOURCE_TYPES.PLAYLIST,
        source_playlist_id: parsed.playlistId,
        source_playlist_url: normalizedPlaylistUrl(parsed.playlistId),
        title: clip(meta?.title || video.title, TITLE_MAX) || video.providerVideoId,
        description: clip(meta?.description, DESCRIPTION_MAX),
        thumbnail_url: meta?.thumbnailUrl || video.thumbnailUrl,
        duration_seconds: meta?.durationSeconds ?? video.durationSeconds,
        lecture_date: null,
        instructor_name: null,
        sort_order: sortOrder,
        status: STATUSES.DRAFT,
        published_at: null,
        created_by_id: user?.userId ?? null,
      };
      sortOrder += 1;
      return row;
    });

    let imported = 0;
    if (rows.length) {
      const result = await lectureRepo.createManyLectures(rows);
      imported = result.count || 0;
    }

    const alreadyExisting = counts.duplicate + Math.max(0, rows.length - imported);
    await recordAudit({
      userId: user?.userId ?? null,
      universityId: user?.universityId ?? null,
      actionType: AUDIT.IMPORTED_PLAYLIST,
      entityType: 'field_training_recorded_lecture',
      entityId: opportunityId,
      newValues: {
        opportunityId,
        provider: 'youtube',
        count: imported,
        playlistId: parsed.playlistId,
      },
    });
    log('info', 'recorded_lectures.youtube.import_playlist', {
      provider: 'youtube',
      operation: 'import_playlist',
      videoCount: imported,
      durationMs: Date.now() - started,
      success: true,
    });

    return {
      playlist: {
        provider: 'YOUTUBE',
        playlistId: parsed.playlistId,
        playlistUrl: normalizedPlaylistUrl(parsed.playlistId),
        title: catalog.playlistTitle,
      },
      summary: {
        found: counts.found,
        valid: counts.valid,
        duplicate: counts.duplicate,
        unavailable: counts.unavailable,
        selected: chosen.length,
        imported,
        alreadyExisting,
        skippedUnavailable: counts.unavailable,
      },
    };
  }

  function resolveSourcePlaylistId(body, lectures) {
    const requested = String(body?.playlist_id || body?.playlistId || '').trim();
    const sources = [
      ...new Set(
        lectures
          .filter((row) => row.source_type === SOURCE_TYPES.PLAYLIST && row.source_playlist_id)
          .map((row) => row.source_playlist_id)
      ),
    ];
    if (requested) {
      if (!sources.includes(requested)) {
        throw new ApiError(404, MSG.youtubePlaylistSourceMissing, null, 'YOUTUBE_PLAYLIST_SOURCE_MISSING');
      }
      return requested;
    }
    if (sources.length === 1) return sources[0];
    if (!sources.length) {
      throw new ApiError(400, MSG.youtubePlaylistSourceMissing, null, 'YOUTUBE_PLAYLIST_SOURCE_MISSING');
    }
    throw new ApiError(400, MSG.youtubePlaylistSourceRequired, null, 'YOUTUBE_PLAYLIST_SOURCE_REQUIRED');
  }

  function buildSyncPreview(catalog, lectures, playlistId) {
    const byVideoId = new Map(
      lectures
        .filter((row) => row.provider === PROVIDERS.YOUTUBE && row.provider_video_id)
        .map((row) => [row.provider_video_id, row])
    );
    const seen = new Set();
    const playlistVideoIds = new Set();
    const videos = catalog.ordered.map((entry) => {
      if (!entry.videoId) {
        return {
          provider: 'YOUTUBE',
          providerVideoId: null,
          title: 'فيديو غير متاح',
          thumbnailUrl: null,
          durationSeconds: null,
          playlistPosition: entry.playlistPosition,
          syncStatus: SYNC.UNAVAILABLE,
          availability: AVAILABILITY.UNAVAILABLE,
          lectureId: null,
        };
      }
      playlistVideoIds.add(entry.videoId);
      const raw = catalog.metadataById.get(entry.videoId);
      const meta = normalizeVideoMetadata(raw, { playlistPosition: entry.playlistPosition });
      const lms = byVideoId.get(entry.videoId) || null;
      if (!meta?.available) {
        return {
          provider: 'YOUTUBE',
          providerVideoId: entry.videoId,
          title: meta?.title || entry.snippetTitle || 'فيديو غير متاح',
          thumbnailUrl: meta?.thumbnailUrl || null,
          durationSeconds: meta?.durationSeconds ?? null,
          playlistPosition: entry.playlistPosition,
          syncStatus: SYNC.UNAVAILABLE,
          availability: AVAILABILITY.UNAVAILABLE,
          lectureId: lms?.id || null,
          warning: MSG.youtubeVideoUnavailable,
        };
      }
      const already = Boolean(lms) || seen.has(entry.videoId);
      seen.add(entry.videoId);
      return {
        provider: 'YOUTUBE',
        providerVideoId: entry.videoId,
        title: meta.title,
        thumbnailUrl: meta.thumbnailUrl,
        durationSeconds: meta.durationSeconds,
        playlistPosition: entry.playlistPosition,
        syncStatus: already ? SYNC.EXISTING : SYNC.NEW,
        availability: AVAILABILITY.AVAILABLE,
        lectureId: lms?.id || null,
      };
    });
    videos.sort((a, b) => (a.playlistPosition ?? 0) - (b.playlistPosition ?? 0));
    const removedFromSource = lectures
      .filter(
        (row) =>
          row.source_type === SOURCE_TYPES.PLAYLIST &&
          row.source_playlist_id === playlistId &&
          row.provider_video_id &&
          !playlistVideoIds.has(row.provider_video_id)
      )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({
        lectureId: row.id,
        providerVideoId: row.provider_video_id,
        title: row.title,
        thumbnailUrl: row.thumbnail_url,
        durationSeconds: row.duration_seconds,
        status: row.status,
        sortOrder: row.sort_order,
        syncStatus: SYNC.REMOVED_FROM_SOURCE,
      }));
    const counts = {
      found: videos.length,
      existing: videos.filter((v) => v.syncStatus === SYNC.EXISTING).length,
      newCount: videos.filter((v) => v.syncStatus === SYNC.NEW).length,
      unavailable: videos.filter((v) => v.syncStatus === SYNC.UNAVAILABLE).length,
      removedFromSource: removedFromSource.length,
    };
    return { videos, removedFromSource, counts, playlistVideoIds };
  }

  async function previewPlaylistSync(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const lectures = await lectureRepo.listByOpportunity(opportunityId);
    const playlistId = resolveSourcePlaylistId(body, lectures);
    const catalog = await loadPlaylistCatalog(playlistId);
    const preview = buildSyncPreview(catalog, lectures, playlistId);
    log('info', 'recorded_lectures.youtube.sync_preview', {
      provider: 'youtube',
      operation: 'sync_preview',
      videoCount: preview.counts.found,
      durationMs: Date.now() - started,
      success: true,
    });
    return {
      playlist: {
        provider: 'YOUTUBE',
        playlistId,
        playlistUrl: normalizedPlaylistUrl(playlistId),
        title: catalog.playlistTitle,
      },
      counts: preview.counts,
      videos: preview.videos,
      removedFromSource: preview.removedFromSource,
    };
  }

  async function applyPlaylistSync(opportunityId, body, user) {
    const started = Date.now();
    await assertManage(opportunityId, user);
    const lectures = await lectureRepo.listByOpportunity(opportunityId);
    const playlistId = resolveSourcePlaylistId(body, lectures);
    const catalog = await loadPlaylistCatalog(playlistId);
    const preview = buildSyncPreview(catalog, lectures, playlistId);

    const importAll = body.import_all === true || body.importAll === true;
    const requested = Array.isArray(body.video_ids)
      ? body.video_ids
      : Array.isArray(body.videoIds)
        ? body.videoIds
        : [];
    const requestedSet = new Set(requested.map((id) => String(id || '').trim()).filter(Boolean));
    const newVideos = preview.videos.filter((video) => video.syncStatus === SYNC.NEW);
    if (!importAll && requestedSet.size === 0 && newVideos.length > 0) {
      throw new ApiError(400, MSG.youtubeSelectionRequired, null, 'YOUTUBE_IMPORT_SELECTION_REQUIRED');
    }
    const chosen = newVideos
      .filter((video) => importAll || requestedSet.has(video.providerVideoId))
      .sort((a, b) => (a.playlistPosition ?? 0) - (b.playlistPosition ?? 0));

    const maxSort = await lectureRepo.findMaxSortOrder(opportunityId);
    let sortOrder = nextImportSortStart(maxSort);
    const rows = chosen.map((video) => {
      const raw = catalog.metadataById.get(video.providerVideoId);
      const meta = normalizeVideoMetadata(raw, { playlistPosition: video.playlistPosition });
      const row = {
        opportunity_id: opportunityId,
        session_id: null,
        provider: PROVIDERS.YOUTUBE,
        provider_video_id: video.providerVideoId,
        source_type: SOURCE_TYPES.PLAYLIST,
        source_playlist_id: playlistId,
        source_playlist_url: normalizedPlaylistUrl(playlistId),
        title: clip(meta?.title || video.title, TITLE_MAX) || video.providerVideoId,
        description: clip(meta?.description, DESCRIPTION_MAX),
        thumbnail_url: meta?.thumbnailUrl || video.thumbnailUrl,
        duration_seconds: meta?.durationSeconds ?? video.durationSeconds,
        lecture_date: null,
        instructor_name: null,
        sort_order: sortOrder,
        status: STATUSES.DRAFT,
        published_at: null,
        created_by_id: user?.userId ?? null,
      };
      sortOrder += 1;
      return row;
    });

    let imported = 0;
    if (rows.length) {
      const result = await lectureRepo.createManyLectures(rows);
      imported = result.count || 0;
    }

    await recordAudit({
      userId: user?.userId ?? null,
      universityId: user?.universityId ?? null,
      actionType: AUDIT.PLAYLIST_SYNCED,
      entityType: 'field_training_recorded_lecture',
      entityId: opportunityId,
      newValues: {
        opportunityId,
        provider: 'youtube',
        playlistId,
        discoveredNew: preview.counts.newCount,
        imported,
        removedFromSource: preview.counts.removedFromSource,
        unavailable: preview.counts.unavailable,
      },
    });
    log('info', 'recorded_lectures.youtube.sync_apply', {
      provider: 'youtube',
      operation: 'sync_apply',
      videoCount: imported,
      durationMs: Date.now() - started,
      success: true,
    });

    return {
      playlist: {
        provider: 'YOUTUBE',
        playlistId,
        playlistUrl: normalizedPlaylistUrl(playlistId),
        title: catalog.playlistTitle,
      },
      summary: {
        found: preview.counts.found,
        existing: preview.counts.existing,
        newCount: preview.counts.newCount,
        unavailable: preview.counts.unavailable,
        removedFromSource: preview.counts.removedFromSource,
        selected: chosen.length,
        imported,
      },
    };
  }

  return {
    previewSingle,
    importSingle,
    previewPlaylist,
    importPlaylist,
    previewPlaylistSync,
    applyPlaylistSync,
    nextImportSortStart,
    AVAILABILITY,
    DUPLICATE,
    SYNC,
    youtube,
  };
}

const youtubeImportService = createYoutubeImportService();

module.exports = {
  ...youtubeImportService,
  createYoutubeImportService,
  nextImportSortStart,
  clip: clip,
  TITLE_MAX,
  DESCRIPTION_MAX,
  AVAILABILITY,
  DUPLICATE,
  SYNC,
};
