'use strict';

const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');
const { isExpelled } = require('./fieldTraining.workflow');
const { MSG, STATUSES } = require('./fieldTraining.recordedLectures.constants');
const {
  DEFAULT_COMPLETION_THRESHOLD_PERCENT,
  MAX_HEARTBEAT_SPAN_SECONDS,
  SEGMENT_GAP_TOLERANCE_SECONDS,
  DURATION_BOUNDS_TOLERANCE_SECONDS,
  RESUME_NEAR_END_SECONDS,
  MAX_SESSION_CURSORS,
  MAX_POSITION_WITHOUT_DURATION,
  WATCH_STATUSES,
  PLAYER_STATES,
  WATCH_MSG,
  getCompletionThresholdPercent,
} = require('./fieldTraining.recordedLectures.watch.constants');
const {
  toIntSecond,
  mergeIntervals,
  uniqueWatchedSeconds,
  computeProgressPercentage,
  reachedCompletion,
  resumePositionSeconds,
} = require('./fieldTraining.recordedLectures.intervals');
const watchRepoDefault = require('./fieldTraining.recordedLectures.watch.repository');

const PLAYING_STATES = new Set([PLAYER_STATES.PLAYING]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyStudentProgress() {
  return {
    uniqueWatchedSeconds: 0,
    totalPlaybackSeconds: 0,
    lastPositionSeconds: 0,
    progressPercentage: null,
    startedAt: null,
    lastWatchedAt: null,
    completedAt: null,
    watchStatus: WATCH_STATUSES.NOT_STARTED,
    resumePositionSeconds: 0,
  };
}

function watchStatusFromProgress(progress, threshold = getCompletionThresholdPercent()) {
  if (progress?.completedAt || progress?.completed_at) return WATCH_STATUSES.COMPLETED;
  const unique = toIntSecond(progress?.uniqueWatchedSeconds ?? progress?.unique_watched_seconds) || 0;
  const pct = progress?.progressPercentage ?? progress?.progress_percentage;
  if (unique <= 0) return WATCH_STATUSES.NOT_STARTED;
  if (pct != null && Number(pct) >= threshold) return WATCH_STATUSES.COMPLETED;
  return WATCH_STATUSES.IN_PROGRESS;
}

function mapStudentProgress(row, { durationSeconds, threshold } = {}) {
  if (!row) return emptyStudentProgress();
  const duration = durationSeconds ?? row.video_duration_seconds ?? null;
  const unique = toIntSecond(row.unique_watched_seconds) || 0;
  const last = toIntSecond(row.last_position_seconds) || 0;
  const completedAt = row.completed_at || null;
  const progressPercentage =
    row.progress_percentage == null ? computeProgressPercentage(unique, duration) : Number(row.progress_percentage);
  const mapped = {
    uniqueWatchedSeconds: unique,
    totalPlaybackSeconds: toIntSecond(row.total_playback_seconds) || 0,
    lastPositionSeconds: last,
    progressPercentage,
    startedAt: row.started_at || null,
    lastWatchedAt: row.last_watched_at || null,
    completedAt,
    watchStatus: watchStatusFromProgress(
      { uniqueWatchedSeconds: unique, progressPercentage, completedAt },
      threshold
    ),
    resumePositionSeconds: resumePositionSeconds({
      lastPositionSeconds: last,
      durationSeconds: duration,
      completedAt,
      nearEndSeconds: RESUME_NEAR_END_SECONDS,
    }),
  };
  if (mapped.completedAt) mapped.watchStatus = WATCH_STATUSES.COMPLETED;
  return mapped;
}

function normalizePlayerState(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return PLAYER_STATES.UNSTARTED;
  if (raw === 'PLAYING' || raw === '1') return PLAYER_STATES.PLAYING;
  if (raw === 'PAUSED' || raw === '2') return PLAYER_STATES.PAUSED;
  if (raw === 'BUFFERING' || raw === '3') return PLAYER_STATES.BUFFERING;
  if (raw === 'ENDED' || raw === '0') return PLAYER_STATES.ENDED;
  if (raw === 'SEEKING' || raw === 'SEEK') return PLAYER_STATES.SEEKING;
  if (raw === 'CUED' || raw === '5') return PLAYER_STATES.CUED;
  if (raw === 'UNSTARTED' || raw === '-1') return PLAYER_STATES.UNSTARTED;
  throw new ApiError(400, WATCH_MSG.playerStateInvalid, null, 'RECORDED_LECTURE_PLAYER_STATE_INVALID');
}

function normalizeWatchSessionId(value) {
  const id = String(value || '').trim();
  if (!id) return crypto.randomUUID();
  if (!UUID_RE.test(id)) {
    throw new ApiError(400, WATCH_MSG.sessionRequired, null, 'RECORDED_LECTURE_WATCH_SESSION_INVALID');
  }
  return id;
}

function rememberCursor(cursors, sessionId, sequenceNumber) {
  const next = { ...(cursors && typeof cursors === 'object' ? cursors : {}) };
  next[sessionId] = sequenceNumber;
  const keys = Object.keys(next);
  if (keys.length > MAX_SESSION_CURSORS) {
    const extra = keys.slice(0, keys.length - MAX_SESSION_CURSORS);
    for (const key of extra) delete next[key];
  }
  return next;
}

function isDuplicateHeartbeat(cursors, sessionId, sequenceNumber) {
  const last = toIntSecond(cursors?.[sessionId]);
  if (last == null) return false;
  return sequenceNumber <= last;
}

function validatePlaybackRange({ fromSecond, toSecond, currentTime, durationSeconds, playerState }) {
  const from = toIntSecond(fromSecond);
  const to = toIntSecond(toSecond);
  const current = toIntSecond(currentTime);
  if (from == null || to == null || current == null || from < 0 || to < 0 || current < 0) {
    throw new ApiError(400, WATCH_MSG.heartbeatInvalid, null, 'RECORDED_LECTURE_HEARTBEAT_INVALID');
  }
  if (from > to) {
    throw new ApiError(400, WATCH_MSG.heartbeatInvalid, null, 'RECORDED_LECTURE_HEARTBEAT_INVALID');
  }
  const duration = toIntSecond(durationSeconds);
  const maxAllowed =
    duration != null && duration > 0
      ? duration + DURATION_BOUNDS_TOLERANCE_SECONDS
      : MAX_POSITION_WITHOUT_DURATION;
  if (from > maxAllowed || to > maxAllowed || current > maxAllowed) {
    throw new ApiError(400, WATCH_MSG.heartbeatOutOfRange, null, 'RECORDED_LECTURE_HEARTBEAT_OUT_OF_RANGE');
  }
  if (duration != null && duration > 0 && from > duration) {
    throw new ApiError(400, WATCH_MSG.heartbeatOutOfRange, null, 'RECORDED_LECTURE_HEARTBEAT_OUT_OF_RANGE');
  }
  const span = to - from;
  if (playerState === PLAYER_STATES.PLAYING && span > MAX_HEARTBEAT_SPAN_SECONDS) {
    throw new ApiError(400, WATCH_MSG.heartbeatSpanTooLarge, null, 'RECORDED_LECTURE_HEARTBEAT_SPAN_TOO_LARGE');
  }
  const clampMax = duration != null && duration > 0 ? duration : maxAllowed;
  return {
    fromSecond: Math.min(from, clampMax),
    toSecond: Math.min(to, clampMax),
    currentTime: Math.min(current, clampMax),
  };
}

function createWatchService(deps = {}) {
  const watchRepo = deps.watchRepo || watchRepoDefault;
  const nowFn = deps.now || (() => new Date());
  const thresholdFn = deps.getCompletionThresholdPercent || getCompletionThresholdPercent;
  const queryCounter = deps.queryCounter || null;

  function countQuery(name) {
    if (queryCounter) queryCounter.push(name);
  }

  async function requireWatchAccess(opportunityId, lectureId, studentId) {
    countQuery('lecture');
    const lecture = await watchRepo.findPublishedLecture(lectureId);
    if (!lecture || String(lecture.opportunity_id) !== String(opportunityId)) {
      throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    }
    if (lecture.status !== STATUSES.PUBLISHED) {
      throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
    }
    countQuery('application');
    const app = await watchRepo.findApprovedApplication(opportunityId, studentId);
    if (!app || app.status !== 'approved' || isExpelled(app)) {
      throw new ApiError(403, MSG.forbidden, null, 'RECORDED_LECTURE_FORBIDDEN');
    }
    return { lecture, app };
  }

  function buildNextProgress(current, { range, playerState, durationSeconds, sessionId, sequenceNumber, countedPlayback }) {
    const now = nowFn();
    const threshold = thresholdFn();
    const existingSegments = (current.segments || []).map((seg) => [seg.start_second, seg.end_second]);
    const nextSegmentsInput =
      countedPlayback && range.toSecond > range.fromSecond
        ? [...existingSegments, [range.fromSecond, range.toSecond]]
        : existingSegments;
    const merged = mergeIntervals(nextSegmentsInput, { gapTolerance: SEGMENT_GAP_TOLERANCE_SECONDS });
    const unique = uniqueWatchedSeconds(merged, { gapTolerance: SEGMENT_GAP_TOLERANCE_SECONDS });
    const playbackDelta =
      countedPlayback && range.toSecond > range.fromSecond ? range.toSecond - range.fromSecond : 0;
    const startedAt = current.started_at || (playbackDelta > 0 ? now : null);
    const alreadyComplete = Boolean(current.completed_at);
    const completeNow = alreadyComplete || reachedCompletion(unique, durationSeconds, threshold);
    return {
      next: {
        video_duration_seconds: durationSeconds ?? current.video_duration_seconds ?? null,
        unique_watched_seconds: unique,
        total_playback_seconds: (toIntSecond(current.total_playback_seconds) || 0) + playbackDelta,
        last_position_seconds: range.currentTime,
        progress_percentage: computeProgressPercentage(unique, durationSeconds),
        started_at: startedAt,
        last_watched_at: playbackDelta > 0 || playerState === PLAYER_STATES.PLAYING ? now : current.last_watched_at || (playbackDelta > 0 ? now : now),
        completed_at: completeNow ? current.completed_at || now : null,
        heartbeat_cursors: rememberCursor(current.heartbeat_cursors, sessionId, sequenceNumber),
      },
      segments: merged,
      unique,
    };
  }

  async function startWatchSession(opportunityId, lectureId, studentId, body = {}) {
    const { lecture, app } = await requireWatchAccess(opportunityId, lectureId, studentId);
    countQuery('ensureProgress');
    const progress = await watchRepo.ensureProgress({
      lectureId,
      applicationId: app.id,
      studentId,
      videoDurationSeconds: lecture.duration_seconds,
    });
    const watchSessionId = normalizeWatchSessionId(body.watchSessionId || body.watch_session_id);
    return {
      watchSessionId,
      lectureId: lecture.id,
      progress: mapStudentProgress(progress, {
        durationSeconds: lecture.duration_seconds,
        threshold: thresholdFn(),
      }),
    };
  }

  async function getProgress(opportunityId, lectureId, studentId) {
    const { lecture, app } = await requireWatchAccess(opportunityId, lectureId, studentId);
    countQuery('listProgress');
    const rows = await watchRepo.listProgressByApplicationAndLectureIds(app.id, [lectureId]);
    return {
      lectureId: lecture.id,
      progress: mapStudentProgress(rows[0], {
        durationSeconds: lecture.duration_seconds,
        threshold: thresholdFn(),
      }),
    };
  }

  async function processHeartbeat(opportunityId, lectureId, studentId, body = {}) {
    const { lecture, app } = await requireWatchAccess(opportunityId, lectureId, studentId);
    const watchSessionId = normalizeWatchSessionId(body.watchSessionId || body.watch_session_id);
    const sequenceNumber = toIntSecond(body.sequenceNumber ?? body.sequence_number);
    if (sequenceNumber == null || sequenceNumber < 0) {
      throw new ApiError(400, WATCH_MSG.sequenceInvalid, null, 'RECORDED_LECTURE_SEQUENCE_INVALID');
    }
    const playerState = normalizePlayerState(body.playerState || body.player_state);
    const durationSeconds = lecture.duration_seconds;
    const range = validatePlaybackRange({
      fromSecond: body.fromSecond ?? body.from_second,
      toSecond: body.toSecond ?? body.to_second,
      currentTime: body.currentTime ?? body.current_time ?? body.toSecond ?? body.to_second,
      durationSeconds,
      playerState,
    });
    countQuery('ensureProgress');
    const current = await watchRepo.ensureProgress({
      lectureId,
      applicationId: app.id,
      studentId,
      videoDurationSeconds: durationSeconds,
    });
    const duplicate = isDuplicateHeartbeat(current.heartbeat_cursors, watchSessionId, sequenceNumber);
    const countedPlayback = !duplicate && PLAYING_STATES.has(playerState) && range.toSecond > range.fromSecond;
    const built = buildNextProgress(current, {
      range,
      playerState,
      durationSeconds,
      sessionId: watchSessionId,
      sequenceNumber,
      countedPlayback,
    });
    if (duplicate) {
      built.next = {
        ...built.next,
        unique_watched_seconds: current.unique_watched_seconds,
        total_playback_seconds: current.total_playback_seconds,
        last_position_seconds: current.last_position_seconds,
        progress_percentage: current.progress_percentage == null ? null : Number(current.progress_percentage),
        started_at: current.started_at,
        last_watched_at: current.last_watched_at,
        completed_at: current.completed_at,
        heartbeat_cursors: current.heartbeat_cursors,
        video_duration_seconds: current.video_duration_seconds,
      };
      built.segments = (current.segments || []).map((seg) => [seg.start_second, seg.end_second]);
    } else if (!countedPlayback) {
      built.next.last_position_seconds = range.currentTime;
      built.next.last_watched_at = nowFn();
      built.next.heartbeat_cursors = rememberCursor(current.heartbeat_cursors, watchSessionId, sequenceNumber);
      built.next.unique_watched_seconds = current.unique_watched_seconds;
      built.next.total_playback_seconds = current.total_playback_seconds;
      built.next.progress_percentage =
        current.progress_percentage == null
          ? computeProgressPercentage(current.unique_watched_seconds, durationSeconds)
          : Number(current.progress_percentage);
      built.next.started_at = current.started_at;
      built.next.completed_at = current.completed_at;
      built.next.video_duration_seconds = durationSeconds ?? current.video_duration_seconds;
      built.segments = (current.segments || []).map((seg) => [seg.start_second, seg.end_second]);
    }
    countQuery('heartbeatTx');
    const saved = await watchRepo.applyHeartbeatTransaction({
      progressId: current.id,
      next: built.next,
      segments: built.segments,
      duplicate,
    });
    return {
      duplicate,
      watchSessionId,
      sequenceNumber,
      progress: mapStudentProgress(saved, {
        durationSeconds,
        threshold: thresholdFn(),
      }),
    };
  }

  async function processPlayerEvent(opportunityId, lectureId, studentId, body = {}) {
    const playerState = normalizePlayerState(body.playerState || body.player_state || body.event);
    const current = body.currentTime ?? body.current_time ?? body.toSecond ?? body.to_second ?? 0;
    return processHeartbeat(opportunityId, lectureId, studentId, {
      ...body,
      playerState,
      fromSecond: body.fromSecond ?? body.from_second ?? current,
      toSecond: body.toSecond ?? body.to_second ?? current,
      currentTime: current,
    });
  }

  async function progressByLectureIds(applicationId, lectureIds) {
    if (!applicationId || !lectureIds?.length) return new Map();
    countQuery('listProgressBatch');
    const rows = await watchRepo.listProgressByApplicationAndLectureIds(applicationId, lectureIds);
    return new Map(rows.map((row) => [String(row.lecture_id), row]));
  }

  return {
    requireWatchAccess,
    startWatchSession,
    getProgress,
    processHeartbeat,
    processPlayerEvent,
    progressByLectureIds,
    mapStudentProgress,
    emptyStudentProgress,
  };
}

const watchService = createWatchService();

module.exports = {
  ...watchService,
  createWatchService,
  mapStudentProgress,
  emptyStudentProgress,
  watchStatusFromProgress,
  normalizePlayerState,
  validatePlaybackRange,
  DEFAULT_COMPLETION_THRESHOLD_PERCENT,
  WATCH_STATUSES,
  PLAYER_STATES,
  getCompletionThresholdPercent,
};
