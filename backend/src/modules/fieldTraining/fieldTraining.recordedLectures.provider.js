'use strict';

const { ApiError } = require('../../utils/apiError');
const {
  PROVIDERS,
  PROVIDER_API,
  MSG,
} = require('./fieldTraining.recordedLectures.constants');

const SUPPORTED_PROVIDERS = new Set(Object.values(PROVIDERS));
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function looksLikeUrl(value) {
  const s = String(value || '').trim();
  return /:\/\//.test(s) || /youtu\.?be/i.test(s) || /vimeo\.com/i.test(s) || /[/?&=]/.test(s);
}

function normalizeProvider(value) {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase();
  if (key === 'youtube' || raw.toUpperCase() === 'YOUTUBE') return PROVIDERS.YOUTUBE;
  if (key === 'vimeo' || raw.toUpperCase() === 'VIMEO') return PROVIDERS.VIMEO;
  throw new ApiError(400, MSG.providerUnsupported, null, 'RECORDED_LECTURE_PROVIDER_UNSUPPORTED');
}

function normalizeProviderVideoId(value) {
  const id = String(value || '').trim();
  if (!id) {
    throw new ApiError(400, MSG.videoIdRequired, null, 'RECORDED_LECTURE_VIDEO_ID_REQUIRED');
  }
  if (looksLikeUrl(id) || !VIDEO_ID_RE.test(id)) {
    throw new ApiError(400, MSG.videoIdInvalid, null, 'RECORDED_LECTURE_VIDEO_ID_INVALID');
  }
  return id;
}

function normalizeVideoReference({ provider, providerVideoId } = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedId = normalizeProviderVideoId(providerVideoId);
  return {
    provider: normalizedProvider,
    providerVideoId: normalizedId,
  };
}

function validateVideoReference(ref = {}) {
  const normalized = normalizeVideoReference(ref);
  if (!SUPPORTED_PROVIDERS.has(normalized.provider)) {
    throw new ApiError(400, MSG.providerUnsupported, null, 'RECORDED_LECTURE_PROVIDER_UNSUPPORTED');
  }
  return normalized;
}

function getEmbedReference(lecture = {}) {
  const provider = lecture.provider || lecture.providerKey;
  const providerVideoId = lecture.provider_video_id || lecture.providerVideoId;
  const normalized = validateVideoReference({ provider, providerVideoId });
  return {
    provider: PROVIDER_API[normalized.provider],
    providerVideoId: normalized.providerVideoId,
    embedKind: normalized.provider === PROVIDERS.YOUTUBE ? 'youtube_embed' : 'vimeo_embed',
  };
}

/**
 * Lightweight provider-neutral adapter. Phase 1 does not call YouTube or Vimeo APIs.
 */
class RecordedLectureProvider {
  constructor(provider) {
    this.key = normalizeProvider(provider);
  }

  validateVideoReference(ref = {}) {
    return validateVideoReference({ ...ref, provider: ref.provider || this.key });
  }

  normalizeVideoReference(ref = {}) {
    return normalizeVideoReference({ ...ref, provider: ref.provider || this.key });
  }

  getEmbedReference(lecture = {}) {
    return getEmbedReference({ ...lecture, provider: lecture.provider || this.key });
  }
}

function getRecordedLectureProvider(provider) {
  return new RecordedLectureProvider(provider);
}

module.exports = {
  RecordedLectureProvider,
  getRecordedLectureProvider,
  normalizeProvider,
  normalizeProviderVideoId,
  normalizeVideoReference,
  validateVideoReference,
  getEmbedReference,
  SUPPORTED_PROVIDERS,
};
