'use strict';

const {
  UNAVAILABLE_AR,
  PROFESSIONAL_INCOMPLETE_TOTAL_AR,
  MANUAL_AUTHORIZED_BULK_RATING,
  PROFESSIONAL_EVALUATION_STATUS,
  SCORE_SOURCE,
  NOT_ELIGIBLE_POLICY_SCORE,
  NOT_ELIGIBLE_POLICY_TOTAL,
  POLICY_ASSIGNED_NOT_ELIGIBLE_REASON_AR,
} = require('./fieldTrainingEvaluation.constants');

const AUTHORIZED_ELIGIBLE_CRITERIA = Object.freeze([3, 4, 6, 7, 8, 10]);

const EXCEL_ELIGIBILITY_MAP = Object.freeze({
  مؤهل: 'ELIGIBLE',
  'غير مؤهل': 'NOT_ELIGIBLE',
  eligible: 'ELIGIBLE',
  ineligible: 'NOT_ELIGIBLE',
  not_eligible: 'NOT_ELIGIBLE',
  ELIGIBLE: 'ELIGIBLE',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
});

const SOFT_TEXT_FALLBACK_KEYS = Object.freeze([
  'student_specialty',
  'semester',
  'academic_year',
  'training_start_date',
  'training_end_date',
  'organization_name',
  'organization_department',
  'organization_email',
  'organization_phone',
  'organization_address',
  'field_supervisor_name',
  'responsible_person_name',
  'academic_supervisor_name',
  'evaluation_date',
  'field_supervisor_date',
  'academic_supervisor_date',
  'general_comments',
]);

const SOFT_NUMERIC_FALLBACK_KEYS = Object.freeze([
  'training_days',
  'training_hours_display',
  'actual_training_hours',
  'absence_days',
]);

function textOrEmpty(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null') return '';
  return text;
}

function normalizeUniversityNumber(value) {
  return String(value || '')
    .replace(/\.0+$/, '')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function mapExcelEligibility(raw) {
  const text = textOrEmpty(raw);
  if (!text) return null;
  return EXCEL_ELIGIBILITY_MAP[text] || EXCEL_ELIGIBILITY_MAP[text.toLowerCase()] || null;
}

function criterionScore(payload, index) {
  const raw = payload[`criterion_${index}_score`];
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function applyAuthorizedEligibleScores(payload) {
  const status = String(payload.eligibility_status || '').toUpperCase();
  if (status !== 'ELIGIBLE') return { payload, filled: [] };
  const filled = [];
  for (const index of AUTHORIZED_ELIGIBLE_CRITERIA) {
    const key = `criterion_${index}_score`;
    if (criterionScore(payload, index) == null) {
      payload[key] = 5;
      filled.push(key);
    }
  }
  return { payload, filled, source: MANUAL_AUTHORIZED_BULK_RATING };
}

function applyNotEligibleReporting(payload) {
  const status = String(payload.eligibility_status || '').toUpperCase();
  if (status !== 'NOT_ELIGIBLE') return payload;
  for (let i = 1; i <= 10; i += 1) {
    payload[`criterion_${i}_score`] = NOT_ELIGIBLE_POLICY_SCORE;
  }
  if (payload.criteria && typeof payload.criteria === 'object') {
    for (let i = 1; i <= 10; i += 1) {
      payload.criteria[`criterion${i}`] = NOT_ELIGIBLE_POLICY_SCORE;
    }
  }
  payload.professional_evaluation_total = NOT_ELIGIBLE_POLICY_TOTAL;
  payload.professionalEvaluationStatus = PROFESSIONAL_EVALUATION_STATUS.POLICY_ASSIGNED_NOT_ELIGIBLE;
  payload.professional_evaluation_status = PROFESSIONAL_EVALUATION_STATUS.POLICY_ASSIGNED_NOT_ELIGIBLE;
  payload.professional_score_source = SCORE_SOURCE.POLICY_ASSIGNED_NOT_ELIGIBLE;
  payload.professional_score_reason = POLICY_ASSIGNED_NOT_ELIGIBLE_REASON_AR;
  return payload;
}

function resolveProfessionalTotal(payload) {
  if (String(payload.eligibility_status || '').toUpperCase() === 'NOT_ELIGIBLE') {
    applyNotEligibleReporting(payload);
    return {
      complete: true,
      total: NOT_ELIGIBLE_POLICY_TOTAL,
      missing: 0,
      skippedDueToIneligibility: false,
      policyAssignedNotEligible: true,
    };
  }
  const scores = [];
  let missing = 0;
  for (let i = 1; i <= 10; i += 1) {
    const score = criterionScore(payload, i);
    if (score == null) missing += 1;
    else scores.push(score);
  }
  if (missing === 0 && scores.length === 10) {
    payload.professional_evaluation_total = scores.reduce((sum, n) => sum + n, 0);
    return { complete: true, total: payload.professional_evaluation_total, missing: 0 };
  }
  payload.professional_evaluation_total = PROFESSIONAL_INCOMPLETE_TOTAL_AR;
  return {
    complete: false,
    total: null,
    availableTotal: scores.reduce((sum, n) => sum + n, 0),
    missing,
  };
}

function applyExcelIdentityOverrides(payload, excelRow = {}) {
  if (!excelRow) return payload;
  if (!textOrEmpty(payload.student_name) && textOrEmpty(excelRow.studentName)) {
    payload.student_name = textOrEmpty(excelRow.studentName);
  }
  if (!textOrEmpty(payload.student_number) && textOrEmpty(excelRow.universityNumber)) {
    payload.student_number = normalizeUniversityNumber(excelRow.universityNumber);
  }
  if (textOrEmpty(excelRow.supervisorName)) {
    payload.academic_supervisor_name = textOrEmpty(excelRow.supervisorName);
    payload.responsible_person_name = textOrEmpty(excelRow.supervisorName);
  }
  if (!textOrEmpty(payload.student_specialty) && textOrEmpty(excelRow.specialty)) {
    payload.student_specialty = textOrEmpty(excelRow.specialty);
  }
  if (!textOrEmpty(payload.organization_name) && textOrEmpty(excelRow.hostOrganization)) {
    payload.organization_name = textOrEmpty(excelRow.hostOrganization);
  }
  if (!textOrEmpty(payload.eligibility_status)) {
    const mapped = mapExcelEligibility(excelRow.eligibilityStatus);
    if (mapped) payload.eligibility_status = mapped;
  }
  return payload;
}

function applyUnavailableFallbacks(payload) {
  for (const key of SOFT_TEXT_FALLBACK_KEYS) {
    if (!textOrEmpty(payload[key])) payload[key] = UNAVAILABLE_AR;
  }
  for (const key of SOFT_NUMERIC_FALLBACK_KEYS) {
    if (payload[key] == null || payload[key] === '') payload[key] = UNAVAILABLE_AR;
  }
  if (!textOrEmpty(payload.eligibility_status)) payload.eligibility_status = 'NOT_ELIGIBLE';
  return payload;
}

function collectMissingWarnings(payload, beforeSoft = {}) {
  const warnings = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('_')) continue;
    if (value === UNAVAILABLE_AR || value === PROFESSIONAL_INCOMPLETE_TOTAL_AR) {
      warnings.push(key);
    }
  }
  for (let i = 1; i <= 10; i += 1) {
    const key = `criterion_${i}_score`;
    if (beforeSoft[key] == null && payload[key] == null) warnings.push(key);
  }
  return [...new Set(warnings)];
}

/**
 * Mutah delivery policy: never block Word export for missing business data.
 * Prefer LMS → Excel → opportunity defaults → غير متوفر.
 */
function applyMutahSoftDeliveryPayload(payloadInput = {}, excelRow = null) {
  const payload = { ...payloadInput };
  const before = { ...payload };
  applyExcelIdentityOverrides(payload, excelRow || {});
  applyNotEligibleReporting(payload);
  const authorized = applyAuthorizedEligibleScores(payload);
  const totalInfo = resolveProfessionalTotal(payload);
  applyUnavailableFallbacks(payload);
  payload._mutahSoftDelivery = true;
  payload._missingDataWarnings = collectMissingWarnings(payload, before);
  payload._authorizedBulkFields = authorized.filled || [];
  payload._professionalComplete = totalInfo.complete;
  return payload;
}

function excelRowsFromImportPreview(preview = {}) {
  const fromSummary = Array.isArray(preview.summary?.rows) ? preview.summary.rows : [];
  if (fromSummary.length) {
    return fromSummary.map((row) => ({
      universityNumber: row.universityNumber || row.university_number,
      studentName: row.studentName || row.student_name,
      supervisorName: row.supervisorName || row.supervisor_name || row.supervisorLabel,
      universityEmail: row.universityEmail || row.university_email,
      specialty: row.specialty,
      hostOrganization: row.hostOrganization || row.host_organization,
      eligibilityStatus: row.eligibilityStatus || row.display_eligibility_status,
      university: row.university,
    }));
  }
  const fromGroups = [];
  for (const group of preview.groups || []) {
    for (const student of group.students || group.rows || []) {
      fromGroups.push({
        universityNumber: student.universityNumber || student.university_number,
        studentName: student.studentName || student.student_name,
        supervisorName:
          student.supervisorName ||
          group.supervisor_label ||
          student.proposed_supervisor_name,
        universityEmail: student.universityEmail || student.university_email,
        specialty: student.specialty,
        hostOrganization: student.hostOrganization || student.host_organization,
        eligibilityStatus: student.eligibilityStatus || student.display_eligibility_status,
        university: student.university,
      });
    }
  }
  return fromGroups;
}

function matchExcelRowsToApplications(excelRows = [], applications = []) {
  const byNumber = new Map();
  const byEmail = new Map();
  for (const app of applications) {
    const student = app.users || app.student || {};
    const number = normalizeUniversityNumber(
      student.university_student_number || student.universityStudentNumber || ''
    );
    const email = normalizeEmail(student.email || '');
    if (number) byNumber.set(number, app);
    if (email) byEmail.set(email, app);
  }

  const matched = [];
  const unmatched = [];
  for (const row of excelRows) {
    const number = normalizeUniversityNumber(row.universityNumber);
    const email = normalizeEmail(row.universityEmail);
    let app = number ? byNumber.get(number) : null;
    if (!app && email) app = byEmail.get(email);
    if (app) {
      matched.push({
        status: 'MATCHED',
        excel: row,
        applicationId: app.id,
        application: app,
      });
    } else {
      unmatched.push({
        status: 'UNMATCHED',
        excel: row,
        code: 'REPORT_REQUIRES_FALLBACK_DATA',
      });
    }
  }
  return { matched, unmatched };
}

function reconcileZipUniversityNumbers(excelNumbers = [], zipNumbers = []) {
  const excelSet = new Set(excelNumbers.map(normalizeUniversityNumber).filter(Boolean));
  const zipList = zipNumbers.map(normalizeUniversityNumber).filter(Boolean);
  const zipSet = new Set(zipList);
  const missingFromZip = [...excelSet].filter((n) => !zipSet.has(n));
  const unexpectedInZip = [...zipSet].filter((n) => !excelSet.has(n));
  const seen = new Set();
  const duplicatesInZip = [];
  for (const n of zipList) {
    if (seen.has(n)) duplicatesInZip.push(n);
    seen.add(n);
  }
  return {
    excelCount: excelSet.size,
    zipCount: zipSet.size,
    missingFromZip,
    unexpectedInZip,
    duplicatesInZip: [...new Set(duplicatesInZip)],
    ok:
      missingFromZip.length === 0 &&
      unexpectedInZip.length === 0 &&
      duplicatesInZip.length === 0 &&
      excelSet.size === zipSet.size,
  };
}

module.exports = {
  AUTHORIZED_ELIGIBLE_CRITERIA,
  normalizeUniversityNumber,
  normalizeEmail,
  mapExcelEligibility,
  applyMutahSoftDeliveryPayload,
  applyAuthorizedEligibleScores,
  applyNotEligibleReporting,
  resolveProfessionalTotal,
  matchExcelRowsToApplications,
  excelRowsFromImportPreview,
  reconcileZipUniversityNumbers,
  UNAVAILABLE_AR,
  PROFESSIONAL_INCOMPLETE_TOTAL_AR,
};
