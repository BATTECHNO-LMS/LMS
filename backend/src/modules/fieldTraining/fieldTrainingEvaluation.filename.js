'use strict';

const names = require('./fieldTraining.supervisorName');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const {
  UNASSIGNED_SUPERVISOR_FOLDER,
  ELIGIBLE_FOLDER_AR,
  NOT_ELIGIBLE_FOLDER_AR,
} = require('./fieldTrainingEvaluation.constants');
const { isEligibleStatus } = require('./fieldTrainingEvaluation.eligibilityReasons');

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

function eligibilityFolderAr(status) {
  const raw = String(status || '').trim();
  if (isEligibleStatus(raw) || raw.toUpperCase() === 'ELIGIBLE') return ELIGIBLE_FOLDER_AR;
  return NOT_ELIGIBLE_FOLDER_AR;
}

function buildOfficialEvaluationZipPath({
  universityName,
  academicSupervisorName,
  eligibilityStatus,
  filename,
} = {}) {
  const root = names.sanitizeZipFolder(universityName) || 'جامعة';
  const supervisor = names.sanitizeZipFolder(academicSupervisorName) || UNASSIGNED_SUPERVISOR_FOLDER;
  const eligibility = eligibilityFolderAr(eligibilityStatus);
  const file = filename || 'evaluation.pdf';
  return `${root}/${supervisor}/${eligibility}/${file}`;
}

function buildOfficialEvaluationsZipFilename({ universityName, academicYear } = {}) {
  const uni = names.sanitizeZipNamePart(universityName) || 'جامعة';
  const year = names.sanitizeZipNamePart(academicYear) || '';
  const base = `${uni}_تقارير_تقييم_التدريب_الميداني`;
  return year ? `${base}_${year}.zip` : `${base}.zip`;
}

function buildZipFilename({ universityName, opportunityTitle, academicYear } = {}) {
  if (universityName && !opportunityTitle) {
    return buildOfficialEvaluationsZipFilename({ universityName, academicYear });
  }
  return buildOfficialEvaluationsZipFilename({ universityName, academicYear });
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
  eligibilityFolderAr,
  buildOfficialEvaluationZipPath,
  buildOfficialEvaluationsZipFilename,
  buildZipFilename,
  uniqueZipEntry,
};
