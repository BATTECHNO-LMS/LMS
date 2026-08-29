'use strict';

const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');

const INVALID_FS = /[<>:"/\\|?*\u0000-\u001f]/g;
const FILENAME_SUFFIX = 'تقييم_التدريب_الميداني';

function sanitizeNamePart(value) {
  const text = String(value || '')
    .replace(INVALID_FS, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return text.slice(0, 80);
}

function resolveUniversityNumber(student = {}) {
  return resolveOfficialUniversityNumber(student).number;
}

function buildEvaluationPdfFilename({ studentName, universityNumber, student } = {}) {
  const name = sanitizeNamePart(studentName || student?.fullName || student?.full_name);
  const number =
    universityNumber != null && String(universityNumber).trim()
      ? sanitizeNamePart(universityNumber)
      : sanitizeNamePart(resolveUniversityNumber(student));
  if (!name || !number) return '';
  if (number.toUpperCase() === 'NA' || number.toLowerCase() === 'undefined') return '';
  return `${name}_${number}_${FILENAME_SUFFIX}.pdf`;
}

function zipFolderForStatus(status) {
  if (status === 'PASSED') return 'Passed';
  if (status === 'FAILED') return 'Failed';
  return 'Not_Eligible';
}

function buildZipFilename({ universityName, opportunityTitle, academicYear } = {}) {
  const uni = sanitizeNamePart(universityName) || 'University';
  const opp = sanitizeNamePart(opportunityTitle) || 'FieldTraining';
  const year = sanitizeNamePart(academicYear) || 'All';
  return `Field_Training_Reports_${uni}_${opp}_${year}.zip`;
}

function uniqueZipEntry(used, folder, filename, mixed) {
  const base = mixed ? `${folder}/${filename}` : filename;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  let i = 2;
  let candidate = mixed ? `${folder}/${stem}_${i}${ext}` : `${stem}_${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = mixed ? `${folder}/${stem}_${i}${ext}` : `${stem}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

module.exports = {
  FILENAME_SUFFIX,
  sanitizeNamePart,
  resolveUniversityNumber,
  buildEvaluationPdfFilename,
  zipFolderForStatus,
  buildZipFilename,
  uniqueZipEntry,
};
