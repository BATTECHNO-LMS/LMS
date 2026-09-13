'use strict';

/**
 * Student-facing duration helpers. Clock values stay LTR so RTL layout
 * cannot reverse hours/minutes/seconds.
 */

export function toWholeSeconds(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function formatClock(seconds) {
  const total = toWholeSeconds(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}

export function durationParts(seconds) {
  const total = toWholeSeconds(seconds);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    total,
  };
}

export function watchStatusKey(progress) {
  if (progress?.completedAt || progress?.watchStatus === 'completed') return 'completed';
  const unique = toWholeSeconds(progress?.uniqueWatchedSeconds);
  if (unique <= 0 && progress?.watchStatus !== 'in_progress') return 'notStarted';
  return 'inProgress';
}

export function watchStatusBadgeVariant(statusKey) {
  if (statusKey === 'completed') return 'success';
  if (statusKey === 'inProgress') return 'info';
  return 'muted';
}

export function formatHumanDuration(seconds, t) {
  if (seconds == null || seconds === '') {
    return t('recordedLectures.studentWatch.noDuration');
  }
  const total = toWholeSeconds(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return t('recordedLectures.studentWatch.hoursMinutes', { hours, minutes });
  }
  if (hours > 0) return t('recordedLectures.studentWatch.hoursOnly', { hours });
  return t('recordedLectures.studentWatch.minutesOnly', { minutes });
}

export function formatPercentValue(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

export function formatLectureDate(value, locale = 'ar') {
  if (!value) return '';
  const raw = String(value);
  const day = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  const lang = String(locale || 'ar').toLowerCase().startsWith('ar') ? 'ar-EG' : 'en-GB';
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}
