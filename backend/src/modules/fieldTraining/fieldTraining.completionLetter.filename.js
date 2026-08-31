'use strict';

const INVALID_FS = /[<>:"/\\|?*\u0000-\u001f]/g;
const LETTER_PDF_SUFFIX = 'كتاب_إنهاء_التدريب';
const ZIP_PREFIX = 'كتب_إنهاء_التدريب';

function sanitizeNamePart(value) {
  const text = String(value || '')
    .replace(INVALID_FS, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return text.slice(0, 80);
}

function contentDispositionAttachment(filename) {
  const raw = String(filename || 'download.bin').replace(/[\r\n"]/g, '_');
  const safeAscii = raw.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').slice(0, 180) || 'download.bin';
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function formatLetterDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function buildCompletionLetterPdfFilename({ studentName, universityNumber } = {}) {
  const name = sanitizeNamePart(studentName);
  const number = sanitizeNamePart(universityNumber);
  if (!name || !number) return '';
  return `${name}_${number}_${LETTER_PDF_SUFFIX}.pdf`;
}

function buildCompletionLettersZipFilename({ opportunityName, date } = {}) {
  const opp = sanitizeNamePart(opportunityName) || 'فرصة_التدريب';
  const stamp = formatLetterDate(date);
  return `${ZIP_PREFIX}_${opp}_${stamp}.zip`;
}

function uniqueZipEntry(used, filename, folder = '') {
  const { sanitizeZipFolder } = require('./fieldTraining.supervisorName');
  const folderName = sanitizeZipFolder(folder);
  const relative = `${folderName}/${filename}`;
  if (!used.has(relative)) {
    used.add(relative);
    return relative;
  }
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  let i = 2;
  let candidate = `${folderName}/${stem}_${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${folderName}/${stem}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

module.exports = {
  LETTER_PDF_SUFFIX,
  ZIP_PREFIX,
  sanitizeNamePart,
  contentDispositionAttachment,
  formatLetterDate,
  buildCompletionLetterPdfFilename,
  buildCompletionLettersZipFilename,
  uniqueZipEntry,
};
