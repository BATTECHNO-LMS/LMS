'use strict';

const { ApiError } = require('../../utils/apiError');
const { MSG } = require('./fieldTraining.recordedLectures.constants');

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,128}$/;

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function invalidUrl() {
  return new ApiError(400, MSG.youtubeUrlInvalid, null, 'YOUTUBE_URL_INVALID');
}

function parseHttpUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = String(url.hostname || '').toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;
  return url;
}

function extractVideoIdFromUrl(url) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  if (url.pathname === '/watch') {
    const v = url.searchParams.get('v');
    return v && VIDEO_ID_RE.test(v) ? v : null;
  }
  const embed = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  const shorts = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shorts) return shorts[1];
  const live = url.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})/);
  if (live) return live[1];
  return null;
}

function extractPlaylistIdFromUrl(url) {
  const list = url.searchParams.get('list');
  if (list && PLAYLIST_ID_RE.test(list)) return list;
  return null;
}

function parseYoutubeVideoInput(input) {
  const raw = String(input || '').trim();
  if (!raw) throw invalidUrl();
  if (VIDEO_ID_RE.test(raw)) {
    return { videoId: raw, playlistId: null, source: 'id' };
  }
  const url = parseHttpUrl(raw);
  if (!url) throw invalidUrl();
  const videoId = extractVideoIdFromUrl(url);
  if (!videoId) throw invalidUrl();
  return {
    videoId,
    playlistId: extractPlaylistIdFromUrl(url),
    source: 'url',
  };
}

function parseYoutubePlaylistInput(input) {
  const raw = String(input || '').trim();
  if (!raw) throw invalidUrl();
  if (PLAYLIST_ID_RE.test(raw) && !VIDEO_ID_RE.test(raw)) {
    return { playlistId: raw, videoId: null, source: 'id' };
  }
  const url = parseHttpUrl(raw);
  if (!url) throw invalidUrl();
  const playlistId = extractPlaylistIdFromUrl(url);
  if (!playlistId) throw invalidUrl();
  return {
    playlistId,
    videoId: extractVideoIdFromUrl(url),
    source: 'url',
  };
}

function normalizedPlaylistUrl(playlistId) {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

function isAllowedYoutubeHost(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ALLOWED_HOSTS.has(String(url.hostname || '').toLowerCase());
  } catch {
    return false;
  }
}

module.exports = {
  VIDEO_ID_RE,
  PLAYLIST_ID_RE,
  ALLOWED_HOSTS,
  parseYoutubeVideoInput,
  parseYoutubePlaylistInput,
  normalizedPlaylistUrl,
  isAllowedYoutubeHost,
};
