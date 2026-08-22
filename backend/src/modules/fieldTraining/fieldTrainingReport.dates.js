'use strict';

const REPORT_TZ = 'Asia/Amman';

function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00+03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatReportDate(value) {
  const d = parseDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function formatReportDateTime(value) {
  const d = parseDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: REPORT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatReportDateAr(value) {
  const d = parseDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('ar-JO', {
    timeZone: REPORT_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

module.exports = {
  REPORT_TZ,
  parseDate,
  formatReportDate,
  formatReportDateTime,
  formatReportDateAr,
};
