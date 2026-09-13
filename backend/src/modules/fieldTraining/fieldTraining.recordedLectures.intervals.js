'use strict';

function toIntSecond(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function normalizeIntervalInput(range) {
  if (Array.isArray(range)) {
    return { start: range[0], end: range[1] };
  }
  if (range && typeof range === 'object') {
    return {
      start: range.start ?? range.startSecond ?? range.start_second ?? range.fromSecond,
      end: range.end ?? range.endSecond ?? range.end_second ?? range.toSecond,
    };
  }
  return { start: null, end: null };
}

/**
 * Merge overlapping or adjacent watched ranges.
 * gapTolerance covers small heartbeat/network holes; large unobserved gaps stay separate.
 */
function mergeIntervals(ranges, { gapTolerance = 2 } = {}) {
  const cleaned = [];
  for (const range of Array.isArray(ranges) ? ranges : []) {
    const { start, end } = normalizeIntervalInput(range);
    let from = toIntSecond(start);
    let to = toIntSecond(end);
    if (from == null || to == null) continue;
    if (from < 0) from = 0;
    if (to < 0) continue;
    if (to <= from) continue;
    cleaned.push([from, to]);
  }
  cleaned.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [start, end] of cleaned) {
    if (!merged.length) {
      merged.push([start, end]);
      continue;
    }
    const last = merged[merged.length - 1];
    if (start <= last[1] + gapTolerance) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function uniqueWatchedSeconds(ranges, options) {
  return mergeIntervals(ranges, options).reduce((sum, [start, end]) => sum + (end - start), 0);
}

function roundPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function computeProgressPercentage(uniqueSeconds, durationSeconds) {
  const unique = toIntSecond(uniqueSeconds);
  const duration = toIntSecond(durationSeconds);
  if (unique == null || duration == null || duration <= 0) return null;
  const raw = (Math.max(0, unique) / duration) * 100;
  return Math.min(100, Math.max(0, roundPercent(raw)));
}

function reachedCompletion(uniqueSeconds, durationSeconds, thresholdPercent) {
  const unique = toIntSecond(uniqueSeconds);
  const duration = toIntSecond(durationSeconds);
  const threshold = Number(thresholdPercent);
  if (unique == null || duration == null || duration <= 0) return false;
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  return unique * 100 >= duration * threshold;
}

function resumePositionSeconds({
  lastPositionSeconds = 0,
  durationSeconds = null,
  completedAt = null,
  nearEndSeconds = 10,
} = {}) {
  const last = Math.max(0, toIntSecond(lastPositionSeconds) || 0);
  if (last <= 0) return 0;
  const duration = toIntSecond(durationSeconds);
  if (duration != null && duration > 0) {
    if (last >= duration - 1) return 0;
    if (completedAt && last >= Math.max(0, duration - nearEndSeconds)) return 0;
  }
  return last;
}

module.exports = {
  toIntSecond,
  mergeIntervals,
  uniqueWatchedSeconds,
  roundPercent,
  computeProgressPercentage,
  reachedCompletion,
  resumePositionSeconds,
};
