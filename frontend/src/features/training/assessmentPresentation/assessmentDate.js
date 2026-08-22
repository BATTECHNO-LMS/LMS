/** Jordan timezone used for trainee assessment availability display. */
export const ASSESSMENT_TIME_ZONE = 'Asia/Amman';

/** Arabic (Jordan) locale for assessment date/time labels. */
export const ASSESSMENT_DATE_LOCALE = 'ar-JO';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse an assessment date value without inventing a value when invalid.
 * Date-only strings (YYYY-MM-DD) are kept as calendar parts to avoid UTC day shifts.
 * @param {unknown} value
 * @returns {null | { kind: 'date-only', year: number, month: number, day: number } | { kind: 'datetime', date: Date }}
 */
export function parseAssessmentDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { kind: 'datetime', date: value };
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnly = DATE_ONLY_RE.exec(raw);
  if (dateOnly) {
    return {
      kind: 'date-only',
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { kind: 'datetime', date };
}

function formatParts(date, options) {
  return new Intl.DateTimeFormat(ASSESSMENT_DATE_LOCALE, {
    timeZone: ASSESSMENT_TIME_ZONE,
    numberingSystem: 'latn',
    ...options,
  }).format(date);
}

/**
 * Format assessment open/close datetimes for Arabic UI.
 * Never returns raw ISO fragments (no `T`, no sliced prefixes).
 * @param {unknown} value
 * @param {{ fallback?: string, dateOnly?: boolean }} [options]
 */
export function formatAssessmentDateTime(value, options = {}) {
  const fallback = options.fallback ?? 'غير محدد';
  const parsed = parseAssessmentDate(value);
  if (!parsed) return fallback;

  if (parsed.kind === 'date-only') {
    // Noon Asia/Amman on that calendar day — avoids accidental day shift.
    const safe = new Date(
      `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}T12:00:00+03:00`
    );
    return formatParts(safe, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (options.dateOnly) {
    return formatParts(parsed.date, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return formatParts(parsed.date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * True when the string looks like a raw ISO / datetime fragment (for regression checks).
 * @param {string} text
 */
export function looksLikeRawIsoDate(text) {
  if (!text || typeof text !== 'string') return false;
  return /T\d{2}:\d{2}/.test(text) || /^\d{4}-\d{2}-\d{2}/.test(text);
}

/**
 * Value for `<input type="datetime-local">` in the given IANA timezone
 * (program timezone, default Asia/Amman) instead of UTC ISO slices.
 * @param {unknown} value
 * @param {string} [timeZone]
 */
export function toDatetimeLocalValue(value, timeZone = ASSESSMENT_TIME_ZONE) {
  const parsed = parseAssessmentDate(value);
  if (!parsed) return '';
  if (parsed.kind === 'date-only') {
    return `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}T00:00`;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).formatToParts(parsed.date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}
