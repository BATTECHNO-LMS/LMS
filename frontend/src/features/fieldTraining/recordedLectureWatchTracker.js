'use strict';

export const HEARTBEAT_INTERVAL_SECONDS = 10;
export const SEEK_JUMP_SECONDS = 6;
export const MAX_HEARTBEAT_RETRIES = 3;

export function youtubePlayerStateName(code) {
  if (code === 1) return 'PLAYING';
  if (code === 2) return 'PAUSED';
  if (code === 3) return 'BUFFERING';
  if (code === 0) return 'ENDED';
  if (code === 5) return 'CUED';
  return 'UNSTARTED';
}

function wholeSecond(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Provider-neutral playback tracker. Adapters feed timeline + player state;
 * this module decides when a watched span is real vs a seek/pause/buffer.
 */
export function createWatchTracker(options = {}) {
  const intervalSeconds = options.intervalSeconds ?? HEARTBEAT_INTERVAL_SECONDS;
  const seekJumpSeconds = options.seekJumpSeconds ?? SEEK_JUMP_SECONDS;
  const onFlush = options.onFlush;
  let sessionId = options.watchSessionId || null;
  let sequence = 0;
  let lastTime = null;
  let pendingFrom = null;
  let playing = false;

  function emit(payload) {
    sequence += 1;
    const next = {
      watchSessionId: sessionId,
      sequenceNumber: sequence,
      fromSecond: payload.fromSecond,
      toSecond: payload.toSecond,
      currentTime: payload.currentTime,
      playerState: payload.playerState,
    };
    if (typeof onFlush === 'function') onFlush(next);
    return next;
  }

  function flushPlayingSpan(fallbackTime) {
    const from = pendingFrom;
    const to = lastTime == null ? wholeSecond(fallbackTime) : wholeSecond(lastTime);
    pendingFrom = null;
    if (from != null && to > from) {
      return emit({
        playerState: 'PLAYING',
        currentTime: to,
        fromSecond: from,
        toSecond: to,
      });
    }
    return null;
  }

  return {
    setSessionId(id) {
      sessionId = id;
    },
    getSessionId() {
      return sessionId;
    },
    getSequence() {
      return sequence;
    },
    getLastTime() {
      return lastTime;
    },
    handleTick(currentTime, playerState) {
      const t = Number(currentTime) || 0;
      if (playerState !== 'PLAYING') {
        playing = false;
        lastTime = t;
        return null;
      }
      if (!playing) {
        playing = true;
        pendingFrom = wholeSecond(t);
        lastTime = t;
        return null;
      }
      const delta = t - (lastTime ?? t);
      if (delta > seekJumpSeconds || delta < -0.35) {
        const flushed = flushPlayingSpan(lastTime);
        pendingFrom = wholeSecond(t);
        lastTime = t;
        playing = true;
        if (flushed) return flushed;
        return emit({
          playerState: 'SEEKING',
          currentTime: wholeSecond(t),
          fromSecond: wholeSecond(t),
          toSecond: wholeSecond(t),
        });
      }
      lastTime = t;
      if (pendingFrom != null && t - pendingFrom >= intervalSeconds) {
        const from = pendingFrom;
        const to = wholeSecond(t);
        pendingFrom = to;
        return emit({
          playerState: 'PLAYING',
          currentTime: to,
          fromSecond: from,
          toSecond: to,
        });
      }
      return null;
    },
    flush(playerState, currentTime) {
      const t = wholeSecond(currentTime);
      const flushed = flushPlayingSpan(currentTime);
      playing = false;
      lastTime = currentTime;
      pendingFrom = null;
      if (flushed) return flushed;
      return emit({
        playerState: playerState || 'PAUSED',
        currentTime: t,
        fromSecond: t,
        toSecond: t,
      });
    },
  };
}
