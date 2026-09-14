'use strict';

const { ApiError } = require('../../utils/apiError');
const {
  ANALYTICS_TIMEZONE,
  MAX_CUSTOM_RANGE_DAYS,
  PERIODS,
} = require('./analytics.definitions');

const TZ = ANALYTICS_TIMEZONE;

function ammanParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

function ammanOffsetIso() {
  const now = new Date();
  const asUtc = Date.UTC(
    Number(ammanParts(now).year),
    Number(ammanParts(now).month) - 1,
    Number(ammanParts(now).day),
    Number(ammanParts(now).hour),
    Number(ammanParts(now).minute),
    Number(ammanParts(now).second)
  );
  const diffMin = Math.round((asUtc - now.getTime()) / 60000);
  const sign = diffMin >= 0 ? '+' : '-';
  const abs = Math.abs(diffMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function zonedDateTime(year, month, day, hour = 0, minute = 0, second = 0) {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${ammanOffsetIso()}`);
}

function startOfAmmanDay(date = new Date()) {
  const p = ammanParts(date);
  return zonedDateTime(p.year, p.month, p.day, 0, 0, 0);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setTime(next.getTime() + days * 24 * 60 * 60 * 1000);
  return next;
}

function parseBoundary(value, endOfDay) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      /* Date objects from Zod YYYY-MM-DD are UTC midnight; reinterpret as Amman day. */
    }
    return value;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return endOfDay ? zonedDateTime(y, m, d, 23, 59, 59) : zonedDateTime(y, m, d, 0, 0, 0);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePeriod(query = {}, now = new Date()) {
  const period = query.period || PERIODS.D30;
  const known = new Set(Object.values(PERIODS));
  if (!known.has(period)) {
    throw new ApiError(400, 'فترة التحليل غير صالحة', null, 'ANALYTICS_PERIOD_INVALID');
  }

  let periodStart;
  let periodEnd = now;
  let hasComparison = true;
  let aggregation = 'daily';

  if (period === PERIODS.TODAY) {
    periodStart = startOfAmmanDay(now);
    aggregation = 'hourly';
  } else if (period === PERIODS.D7) {
    periodStart = addDays(now, -7);
    aggregation = 'daily';
  } else if (period === PERIODS.D30) {
    periodStart = addDays(now, -30);
    aggregation = 'daily';
  } else {
    const from = parseBoundary(query.dateFrom || query.from, false);
    const to = parseBoundary(query.dateTo || query.to, true);
    if (!from || !to) {
      throw new ApiError(400, 'يجب تحديد تاريخ البداية والنهاية للفترة المخصصة', null, 'ANALYTICS_DATE_RANGE_REQUIRED');
    }
    if (from > to) {
      throw new ApiError(400, 'تاريخ البداية يجب أن يسبق تاريخ النهاية', null, 'ANALYTICS_DATE_RANGE_INVALID');
    }
    const maxMs = MAX_CUSTOM_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new ApiError(400, 'لا يمكن أن تتجاوز الفترة المخصصة سنة واحدة', null, 'ANALYTICS_DATE_RANGE_TOO_LONG');
    }
    periodStart = from;
    periodEnd = to;
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (days <= 2) aggregation = 'hourly';
    else if (days > 60) aggregation = 'weekly';
    else aggregation = 'daily';
  }

  const durationMs = Math.max(periodEnd.getTime() - periodStart.getTime(), 1);
  const previousEnd = periodStart;
  const previousStart = new Date(periodStart.getTime() - durationMs);

  return {
    period,
    periodStart,
    periodEnd,
    previousStart,
    previousEnd,
    hasComparison,
    aggregation,
    timezone: TZ,
  };
}

function formatAmmanLabel(date, aggregation) {
  if (!date) return '';
  if (aggregation === 'hourly') {
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: TZ,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }
  if (aggregation === 'weekly') {
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: TZ,
      month: 'short',
      day: 'numeric',
    }).format(date);
  }
  return new Intl.DateTimeFormat('ar-JO', {
    timeZone: TZ,
    month: 'long',
    day: 'numeric',
  }).format(date);
}

module.exports = {
  ANALYTICS_TIMEZONE: TZ,
  resolvePeriod,
  startOfAmmanDay,
  parseBoundary,
  formatAmmanLabel,
  ammanParts,
};
