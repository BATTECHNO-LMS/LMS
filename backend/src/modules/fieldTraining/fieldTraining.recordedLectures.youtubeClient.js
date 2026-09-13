'use strict';

const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { log } = require('../../utils/logger');
const { MSG } = require('./fieldTraining.recordedLectures.constants');
const { parseIso8601Duration } = require('./fieldTraining.recordedLectures.iso8601Duration');

const API_ORIGIN = 'https://www.googleapis.com';
const API_BASE = `${API_ORIGIN}/youtube/v3`;
const VIDEO_BATCH = 50;
const PLAYLIST_PAGE = 50;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function youtubeErrorReason(payload) {
  const errors = payload?.error?.errors;
  if (Array.isArray(errors) && errors[0]?.reason) return String(errors[0].reason);
  return String(payload?.error?.status || payload?.error?.message || '');
}

function mapYoutubeHttpError(status, reason) {
  const quota = /quota|dailyLimit/i.test(reason) || status === 429;
  const invalidKey = /keyInvalid|API_KEY_INVALID|keyExpired/i.test(reason);
  if (quota) {
    return new ApiError(503, MSG.youtubeQuota, null, 'YOUTUBE_QUOTA_EXCEEDED');
  }
  if (invalidKey) {
    return new ApiError(503, MSG.youtubeKeyMissing, null, 'YOUTUBE_API_KEY_INVALID');
  }
  if (status === 404 || /playlistNotFound|videoNotFound|notFound/i.test(reason)) {
    return null;
  }
  if (status >= 500 || status === 0) {
    return new ApiError(503, MSG.youtubeUnavailable, null, 'YOUTUBE_UNAVAILABLE');
  }
  return new ApiError(503, MSG.youtubeUnavailable, null, 'YOUTUBE_UNAVAILABLE');
}

function requireApiKey(apiKey) {
  if (!apiKey) {
    throw new ApiError(503, MSG.youtubeKeyMissing, null, 'YOUTUBE_API_KEY_MISSING');
  }
  return apiKey;
}

function pickThumbnail(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    null
  );
}

function isRetryable(status, err) {
  if (status && RETRYABLE_STATUS.has(status)) return true;
  const code = err?.cause?.code || err?.code;
  return ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(
    String(code || '')
  );
}

function createYoutubeClient(deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const getApiKey = deps.getApiKey || (() => env.YOUTUBE_API_KEY);
  const timeoutMs = deps.timeoutMs || env.YOUTUBE_API_TIMEOUT_MS || 15_000;
  const maxAttempts = deps.maxAttempts || 3;
  const stats = {
    playlistItemsCalls: 0,
    videosListCalls: 0,
    playlistsListCalls: 0,
  };

  async function request(resource, params, { operation } = {}) {
    const apiKey = requireApiKey(getApiKey());
    let attempt = 0;
    let lastError = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      const search = new URLSearchParams({ ...params, key: apiKey });
      const url = `${API_BASE}/${resource}?${search.toString()}`;
      const started = Date.now();
      try {
        const res = await fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const durationMs = Date.now() - started;
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          const reason = youtubeErrorReason(payload);
          const mapped = mapYoutubeHttpError(res.status, reason);
          log('warn', 'recorded_lectures.youtube.http_error', {
            provider: 'youtube',
            operation,
            status: res.status,
            reason: reason || null,
            durationMs,
            attempt,
            success: false,
          });
          if (res.status === 403 && /quota/i.test(reason)) {
            throw mapped;
          }
          if (res.status === 400 || res.status === 403 || res.status === 404) {
            if (mapped) throw mapped;
            const notFound = new Error('YOUTUBE_NOT_FOUND');
            notFound.code = 'YOUTUBE_NOT_FOUND';
            notFound.status = res.status;
            throw notFound;
          }
          if (isRetryable(res.status) && attempt < maxAttempts) {
            await sleep(Math.min(400 * 2 ** (attempt - 1), 4000));
            continue;
          }
          throw mapped || new ApiError(503, MSG.youtubeUnavailable, null, 'YOUTUBE_UNAVAILABLE');
        }
        const data = await res.json();
        log('info', 'recorded_lectures.youtube.request', {
          provider: 'youtube',
          operation,
          status: res.status,
          durationMs,
          itemCount: Array.isArray(data.items) ? data.items.length : 0,
          success: true,
        });
        return data;
      } catch (err) {
        lastError = err;
        if (err instanceof ApiError) throw err;
        if (err?.code === 'YOUTUBE_NOT_FOUND') throw err;
        if (isRetryable(err.status, err) && attempt < maxAttempts) {
          await sleep(Math.min(400 * 2 ** (attempt - 1), 4000));
          continue;
        }
        log('warn', 'recorded_lectures.youtube.request_failed', {
          provider: 'youtube',
          operation,
          attempt,
          success: false,
        });
        throw new ApiError(503, MSG.youtubeUnavailable, null, 'YOUTUBE_UNAVAILABLE');
      }
    }
    throw lastError || new ApiError(503, MSG.youtubeUnavailable, null, 'YOUTUBE_UNAVAILABLE');
  }

  async function getVideo(videoId) {
    stats.videosListCalls += 1;
    try {
      const data = await request(
        'videos',
        { part: 'snippet,contentDetails,status', id: videoId, maxResults: '1' },
        { operation: 'videos.list' }
      );
      return data.items?.[0] || null;
    } catch (err) {
      if (err?.code === 'YOUTUBE_NOT_FOUND') return null;
      throw err;
    }
  }

  async function getVideos(videoIds) {
    const unique = [...new Set(videoIds.filter(Boolean))];
    const byId = new Map();
    for (let i = 0; i < unique.length; i += VIDEO_BATCH) {
      const chunk = unique.slice(i, i + VIDEO_BATCH);
      stats.videosListCalls += 1;
      const data = await request(
        'videos',
        {
          part: 'snippet,contentDetails,status',
          id: chunk.join(','),
          maxResults: String(VIDEO_BATCH),
        },
        { operation: 'videos.list' }
      );
      for (const item of data.items || []) {
        if (item?.id) byId.set(item.id, item);
      }
    }
    return byId;
  }

  async function getPlaylist(playlistId) {
    stats.playlistsListCalls += 1;
    try {
      const data = await request(
        'playlists',
        { part: 'snippet,contentDetails,status', id: playlistId, maxResults: '1' },
        { operation: 'playlists.list' }
      );
      return data.items?.[0] || null;
    } catch (err) {
      if (err?.code === 'YOUTUBE_NOT_FOUND') return null;
      throw err;
    }
  }

  async function listPlaylistItems(playlistId, { maxItems } = {}) {
    const items = [];
    let pageToken = '';
    let totalResults = null;
    do {
      stats.playlistItemsCalls += 1;
      const params = {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(PLAYLIST_PAGE),
      };
      if (pageToken) params.pageToken = pageToken;
      let data;
      try {
        data = await request('playlistItems', params, { operation: 'playlistItems.list' });
      } catch (err) {
        if (err?.code === 'YOUTUBE_NOT_FOUND') return { items: [], totalResults: 0 };
        throw err;
      }
      if (totalResults == null) {
        totalResults = Number(data.pageInfo?.totalResults ?? 0);
        if (maxItems && totalResults > maxItems) {
          const error = new ApiError(
            400,
            MSG.youtubePlaylistTooLarge,
            { maxItems: maxItems },
            'YOUTUBE_PLAYLIST_TOO_LARGE'
          );
          throw error;
        }
      }
      items.push(...(data.items || []));
      if (maxItems && items.length > maxItems) {
        throw new ApiError(400, MSG.youtubePlaylistTooLarge, { maxItems }, 'YOUTUBE_PLAYLIST_TOO_LARGE');
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return { items, totalResults: totalResults ?? items.length };
  }

  return {
    stats,
    getVideo,
    getVideos,
    getPlaylist,
    listPlaylistItems,
    pickThumbnail,
    parseIso8601Duration,
    VIDEO_BATCH,
    PLAYLIST_PAGE,
  };
}

function normalizeVideoMetadata(item, { playlistPosition = null } = {}) {
  if (!item) return null;
  const privacy = item.status?.privacyStatus || null;
  const uploadStatus = item.status?.uploadStatus || null;
  const title = String(item.snippet?.title || '').trim();
  const deleted =
    /^deleted video$/i.test(title) ||
    /^private video$/i.test(title) ||
    privacy === 'private' ||
    uploadStatus === 'rejected' ||
    uploadStatus === 'deleted' ||
    uploadStatus === 'failed';
  const durationSeconds = parseIso8601Duration(item.contentDetails?.duration);
  return {
    providerVideoId: item.id,
    title: title || item.id,
    description: String(item.snippet?.description || '').trim() || null,
    thumbnailUrl: pickThumbnail(item.snippet?.thumbnails),
    durationSeconds,
    privacyStatus: privacy,
    uploadStatus,
    playlistPosition,
    available: !deleted && Boolean(item.id) && privacy !== 'private',
  };
}

module.exports = {
  createYoutubeClient,
  normalizeVideoMetadata,
  pickThumbnail,
  VIDEO_BATCH,
  PLAYLIST_PAGE,
  API_BASE,
};
