'use strict';

const { ApiError } = require('./apiError');

/**
 * Parse a YYYY-MM-DD (or Date-compatible) value as UTC midnight.
 * Used for academic cohort/session bounds.
 */
function parseDateOnly(s) {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid date');
  return d;
}

/**
 * Persist a date-only form value as a Date (UTC midnight) without shifting the calendar day.
 */
function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Format a Date or ISO value as YYYY-MM-DD for API payloads.
 * Date-only strings are returned as-is to avoid UTC day shifts.
 */
function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

const dateOnlyISO = formatDateOnly;

module.exports = {
  parseDateOnly,
  toDateOnly,
  formatDateOnly,
  dateOnlyISO,
};
