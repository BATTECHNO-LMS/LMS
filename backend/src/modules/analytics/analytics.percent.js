'use strict';

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 1) {
  const n = toFiniteNumber(value, null);
  if (n == null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Safe percentage. Returns null when denominator is 0 or either side is non-finite.
 * Never returns Infinity or NaN.
 */
function safePercent(numerator, denominator, digits = 1) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return round((n / d) * 100, digits);
}

/**
 * Previous-period comparison.
 * - null previous / no comparison window → { changePercent: null, kind: 'none' }
 * - previous 0 and current > 0 → { changePercent: null, kind: 'new' }
 * - previous 0 and current 0 → { changePercent: null, kind: 'none' }
 */
function periodChange(current, previous, { hasPreviousPeriod = true } = {}) {
  if (!hasPreviousPeriod) {
    return { changePercent: null, kind: 'none', current: toFiniteNumber(current), previous: null };
  }
  const cur = toFiniteNumber(current);
  const prev = toFiniteNumber(previous);
  if (prev === 0 && cur > 0) {
    return { changePercent: null, kind: 'new', current: cur, previous: prev };
  }
  if (prev === 0) {
    return { changePercent: null, kind: 'none', current: cur, previous: prev };
  }
  return {
    changePercent: round(((cur - prev) / prev) * 100, 1),
    kind: 'delta',
    current: cur,
    previous: prev,
  };
}

function intCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

module.exports = {
  toFiniteNumber,
  round,
  safePercent,
  periodChange,
  intCount,
};
