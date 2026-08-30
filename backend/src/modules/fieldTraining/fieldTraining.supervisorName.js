'use strict';

const INVALID_FS = /[<>:"/\\|?*\u0000-\u001f]/g;

const UNASSIGNED_SUPERVISOR_LABEL = 'مشرف غير محدد';
const REPORT_PDF_SUFFIX = 'تقرير_التقييم';
const SUPERVISOR_REPORTS_ZIP_PREFIX = 'تقارير';
const ALL_REPORTS_ZIP_PREFIX = 'تقارير_التقييم';

function displaySupervisorName(value) {
  return String(value || '')
    .replace(/[\u200f\u200e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSupervisorKey(value) {
  return displaySupervisorName(value)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\s*\.\s*/g, '.');
}

function supervisorNamesEqual(a, b) {
  const left = normalizeSupervisorKey(a);
  const right = normalizeSupervisorKey(b);
  return Boolean(left) && left === right;
}

function resolvedSupervisorDisplay(name) {
  return displaySupervisorName(name) || UNASSIGNED_SUPERVISOR_LABEL;
}

function resolvedSupervisorKey(name) {
  return normalizeSupervisorKey(name) || '';
}

function sanitizeZipFolder(value) {
  const text = resolvedSupervisorDisplay(value)
    .replace(INVALID_FS, '')
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 80) || UNASSIGNED_SUPERVISOR_LABEL;
}

function sanitizeZipNamePart(value) {
  const text = String(value || '')
    .replace(INVALID_FS, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return text.slice(0, 80);
}

function studentCountLabel(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n === 1) return 'طالب واحد';
  if (n === 2) return 'طالبان';
  if (n >= 3 && n <= 10) return `${n} طلاب`;
  return `${n} طالبًا`;
}

function supervisorGroupTitle(name, count) {
  return `${resolvedSupervisorDisplay(name)} — ${studentCountLabel(count)}`;
}

function buildSupervisorReportPdfFilename({ studentName, universityNumber } = {}) {
  const name = sanitizeZipNamePart(studentName);
  const number = sanitizeZipNamePart(universityNumber);
  if (!name || !number) return '';
  return `${name}_${number}_${REPORT_PDF_SUFFIX}.pdf`;
}

function buildSupervisorReportsZipFilename(supervisorName) {
  const part = sanitizeZipNamePart(resolvedSupervisorDisplay(supervisorName)) || 'مشرف';
  return `${SUPERVISOR_REPORTS_ZIP_PREFIX}_${part}.zip`;
}

function buildAllSupervisorReportsZipFilename(opportunityName) {
  const opp = sanitizeZipNamePart(opportunityName) || 'فرصة_التدريب';
  return `${ALL_REPORTS_ZIP_PREFIX}_${opp}.zip`;
}

function groupRowsBySupervisorName(rows, getName) {
  const groups = new Map();
  for (const row of rows || []) {
    const display = displaySupervisorName(typeof getName === 'function' ? getName(row) : row?.academic_supervisor_name);
    const key = normalizeSupervisorKey(display);
    const current = groups.get(key) || {
      supervisor_label: display || UNASSIGNED_SUPERVISOR_LABEL,
      supervisor_normalized: key,
      unassigned: !key,
      students: [],
    };
    if (!current.supervisor_label && display) current.supervisor_label = display;
    current.students.push(row);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    return b.students.length - a.students.length || a.supervisor_label.localeCompare(b.supervisor_label, 'ar');
  });
}

module.exports = {
  UNASSIGNED_SUPERVISOR_LABEL,
  REPORT_PDF_SUFFIX,
  displaySupervisorName,
  normalizeSupervisorKey,
  supervisorNamesEqual,
  resolvedSupervisorDisplay,
  resolvedSupervisorKey,
  sanitizeZipFolder,
  sanitizeZipNamePart,
  studentCountLabel,
  supervisorGroupTitle,
  buildSupervisorReportPdfFilename,
  buildSupervisorReportsZipFilename,
  buildAllSupervisorReportsZipFilename,
  groupRowsBySupervisorName,
};
