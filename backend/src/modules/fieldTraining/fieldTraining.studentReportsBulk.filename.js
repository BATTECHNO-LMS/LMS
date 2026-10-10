'use strict';

const INVALID_FS = /[<>:"/\\|?*\u0000-\u001f]/g;

function sanitizeNamePart(value) {
  const text = String(value || '')
    .replace(INVALID_FS, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text.slice(0, 80);
}

function contentDispositionAttachment(filename) {
  const raw = String(filename || 'download.bin').replace(/[\r\n"]/g, '_');
  const safeAscii = raw.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'download.bin';
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function formatExportDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function buildStudentReportPdfFilename({ index, studentName, universityNumber } = {}) {
  const seq = String(Number(index) || 1).padStart(3, '0');
  const name = sanitizeNamePart(studentName) || 'طالب';
  const number = sanitizeNamePart(universityNumber) || 'بدون-رقم';
  return `${seq}-${name}-${number}.pdf`;
}

function buildStudentReportsZipFilename({ opportunityTitle, date } = {}) {
  const opp = sanitizeNamePart(opportunityTitle) || 'field-training';
  const stamp = formatExportDate(date);
  return `eprojecto-field-training-student-reports-${opp}-${stamp}.zip`;
}

function uniqueZipEntry(used, filename) {
  const base = String(filename || 'report.pdf').replace(/^(\.\.\/)+/g, '').replace(/\\/g, '/');
  const safe = base.split('/').filter((part) => part && part !== '.' && part !== '..').join('/');
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  const dot = safe.lastIndexOf('.');
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : '';
  let i = 2;
  let candidate = `${stem}-${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

module.exports = {
  sanitizeNamePart,
  contentDispositionAttachment,
  formatExportDate,
  buildStudentReportPdfFilename,
  buildStudentReportsZipFilename,
  uniqueZipEntry,
};
