'use strict';

const { PLACEHOLDERS, UNAVAILABLE_AR, DATA_INCOMPLETE_CODE } = require('./fieldTrainingEvaluation.constants');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const hoursMod = require('./fieldTraining.hours');

const REQUIRED_IDENTITY_FIELDS = Object.freeze([
  'student_name',
  'student_number',
  'student_specialty',
  'training_start_date',
  'training_end_date',
]);

const REQUIRED_COMPLETE_FIELDS = Object.freeze([
  'student_name',
  'student_number',
  'student_specialty',
  'semester',
  'academic_year',
  'training_start_date',
  'training_end_date',
  'training_days',
  'actual_daily_hours',
  'absence_days',
  'organization_name',
  'general_comments',
  'field_supervisor_name',
  'responsible_person_name',
  'evaluation_date',
  'professional_evaluation_total',
]);

const OPTIONAL_ORG_FIELDS = Object.freeze([
  'organization_department',
  'organization_email',
  'organization_phone',
  'organization_fax',
  'organization_address',
]);

const PREVIEW_PAYLOAD_KEYS = Object.freeze([
  'student_name',
  'student_number',
  'student_specialty',
  'semester',
  'academic_year',
  'training_start_date',
  'training_end_date',
  'training_days',
  'actual_training_hours',
  'actual_daily_hours',
  'absence_days',
  'attendance_percentage',
]);

const ATTENDED_STATUSES = hoursMod.HOURS_ATTENDED_STATUSES;

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrEmpty(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null') return '';
  return text;
}

function optionalOrgValue(value) {
  const text = textOrEmpty(value);
  return text || UNAVAILABLE_AR;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}/${m}/${y}`;
}

/**
 * Infer semester / academic year from a stored opportunity start date.
 * Jordan calendar: Sep–Jan first, Feb–May second, Jun–Aug summer (end of prior Sep year).
 */
function academicPeriod(date) {
  if (!date) return { semester: '', academicYear: '' };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { semester: '', academicYear: '' };
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  if (month >= 6 && month <= 8) {
    return { semester: 'الصيفي', academicYear: `${year - 1}/${year}` };
  }
  if (month >= 9) return { semester: 'الفصل الأول', academicYear: `${year}/${year + 1}` };
  if (month <= 1) return { semester: 'الفصل الأول', academicYear: `${year - 1}/${year}` };
  return { semester: 'الفصل الثاني', academicYear: `${year - 1}/${year}` };
}

function academicPeriodFromOpportunity(opportunity = {}) {
  return academicPeriod(opportunity.start_date || opportunity.startDate || null);
}

function hostOrg(opportunity = {}) {
  const raw =
    opportunity.host_organization && typeof opportunity.host_organization === 'object'
      ? opportunity.host_organization
      : {};
  return {
    department: raw.department || raw.organization_department || '',
    email: raw.email || raw.organization_email || '',
    phone: raw.phone || raw.organization_phone || '',
    fax: raw.fax || raw.organization_fax || '',
    address: raw.address || raw.organization_address || opportunity.location || '',
    contactPerson:
      raw.contact_person ||
      raw.contactPerson ||
      raw.responsible_person ||
      raw.responsible_person_name ||
      raw.contact_name ||
      opportunity.contact_person ||
      '',
  };
}

function resolveStudentDisplayName(student = {}) {
  return textOrEmpty(student.full_name || student.fullName);
}

function resolveStudentNumber(student = {}) {
  return resolveOfficialUniversityNumber(student).number;
}

function resolveSpecialtyLabel(student = {}) {
  return (
    textOrEmpty(student.specialty_label) ||
    textOrEmpty(student.specialtyLabel) ||
    textOrEmpty(student.university_specialty?.name_ar) ||
    textOrEmpty(student.university_specialty?.name_en) ||
    textOrEmpty(student.specialty?.name_ar) ||
    textOrEmpty(student.specialty?.name_en) ||
    textOrEmpty(student.canonical_specialty?.name_ar) ||
    textOrEmpty(student.canonical_specialty?.name_en)
  );
}

function summarizeAttendance(attendanceRows = [], application = {}) {
  const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
  const attendedRows = rows.filter((row) => ATTENDED_STATUSES.has(row.status));
  const absenceDays = rows.filter((row) => row.status === 'absent').length;
  const attendedDays = attendedRows.length;
  const storedHours = num(application.completed_training_hours);
  const derivedHours = hoursMod.minutesToHours(hoursMod.sumCompletedMinutesFromRecords(rows));
  const actualHours = storedHours != null && storedHours > 0 ? storedHours : derivedHours;
  const dailyHours =
    attendedDays > 0 ? Math.round((Number(actualHours || 0) / attendedDays) * 10) / 10 : null;
  const attendancePercentage = num(application.attendance_percentage);
  return {
    attendedDays,
    absenceDays,
    actualHours: Number(actualHours || 0),
    actualDailyHours: dailyHours,
    attendancePercentage,
  };
}

function statusLabelAr(status) {
  if (status === 'PASSED') return 'ناجح';
  if (status === 'FAILED') return 'راسب';
  if (status === 'NOT_ELIGIBLE') return 'غير مؤهل';
  return textOrEmpty(status);
}

function criterionScoreOf(evaluation = {}, index) {
  const raw =
    evaluation[`criterion${index}Score`] ??
    evaluation[`criterion_${index}_score`] ??
    evaluation.criteria?.[`criterion${index}`] ??
    evaluation.criteria?.[`criterion_${index}_score`];
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function validateCriteriaGrid(evaluation = {}) {
  const scores = [];
  const missing = [];
  const invalid = [];
  for (let i = 1; i <= 10; i += 1) {
    const score = criterionScoreOf(evaluation, i);
    if (score == null) {
      missing.push(`criterion_${i}_score`);
      continue;
    }
    if (score < 1 || score > 5) invalid.push(`criterion_${i}_score`);
    scores.push(score);
  }
  if (missing.length || invalid.length) {
    return {
      ok: false,
      code: 'PROFESSIONAL_EVALUATION_INCOMPLETE',
      missing: [...missing, ...invalid],
      total: null,
      scores,
    };
  }
  const total = scores.reduce((sum, n) => sum + n, 0);
  if (total < 10 || total > 50) {
    return { ok: false, code: 'PROFESSIONAL_EVALUATION_TOTAL_INVALID', missing: ['professional_evaluation_total'], total, scores };
  }
  return { ok: true, code: null, missing: [], total, scores };
}

/**
 * Single mapping used by preview, generate, regenerate, DOCX, and PDF.
 */
function buildFieldTrainingEvaluationTemplatePayload({
  student = {},
  application = {},
  opportunity = {},
  instructor = null,
  attendanceRows = [],
  evaluation = {},
  specialtyLabel = null,
} = {}) {
  const period = academicPeriodFromOpportunity(opportunity);
  const org = hostOrg(opportunity);
  const hours = summarizeAttendance(attendanceRows, application);
  const studentNumber = resolveStudentNumber(student);
  const reasons = Array.isArray(evaluation.eligibilityReasons)
    ? evaluation.eligibilityReasons
    : [];
  const criteriaCheck = validateCriteriaGrid(evaluation);
  const professionalTotal =
    criteriaCheck.ok
      ? criteriaCheck.total
      : evaluation.professionalTotal == null
        ? ''
        : evaluation.professionalTotal;

  const payload = {
    student_name: resolveStudentDisplayName(student),
    student_number: studentNumber,
    student_specialty: textOrEmpty(specialtyLabel) || resolveSpecialtyLabel(student),
    semester: period.semester,
    academic_year: period.academicYear,
    training_start_date: formatDate(opportunity.start_date),
    training_end_date: formatDate(opportunity.end_date),
    training_days: hours.attendedDays,
    actual_training_hours: hours.actualHours,
    actual_daily_hours: hours.actualDailyHours == null ? '' : hours.actualDailyHours,
    absence_days: hours.absenceDays,
    attendance_percentage:
      hours.attendancePercentage == null ? '' : hours.attendancePercentage,
    organization_name: textOrEmpty(opportunity.organization_name),
    organization_department: optionalOrgValue(org.department),
    organization_email: optionalOrgValue(org.email),
    organization_phone: optionalOrgValue(org.phone),
    organization_fax: optionalOrgValue(org.fax),
    organization_address: optionalOrgValue(org.address),
    completion_status: textOrEmpty(application.completion_eligibility_status),
    final_status: statusLabelAr(evaluation.finalStatus),
    final_score: evaluation.finalScore == null ? '' : evaluation.finalScore,
    final_percentage: evaluation.finalPercentage == null ? '' : evaluation.finalPercentage,
    professional_evaluation_total: professionalTotal,
    professional_evaluation_percentage:
      evaluation.professionalPercentage == null ? '' : evaluation.professionalPercentage,
    general_comments: evaluation.generalComments || evaluation.autoComment || '',
    field_supervisor_name: instructor?.full_name || instructor?.fullName || '',
    responsible_person_name: textOrEmpty(org.contactPerson),
    evaluation_date: formatDate(evaluation.evaluationDate || evaluation.finalizedAt || evaluation.finalized_at),
    eligibility_reasons: reasons
      .map((code) => evaluation.reasonLabels?.[code] || code)
      .filter(Boolean)
      .join('؛ '),
    criterion_1_score: criterionScoreOf(evaluation, 1),
    criterion_2_score: criterionScoreOf(evaluation, 2),
    criterion_3_score: criterionScoreOf(evaluation, 3),
    criterion_4_score: criterionScoreOf(evaluation, 4),
    criterion_5_score: criterionScoreOf(evaluation, 5),
    criterion_6_score: criterionScoreOf(evaluation, 6),
    criterion_7_score: criterionScoreOf(evaluation, 7),
    criterion_8_score: criterionScoreOf(evaluation, 8),
    criterion_9_score: criterionScoreOf(evaluation, 9),
    criterion_10_score: criterionScoreOf(evaluation, 10),
    criteria: {
      criterion1: criterionScoreOf(evaluation, 1),
      criterion2: criterionScoreOf(evaluation, 2),
      criterion3: criterionScoreOf(evaluation, 3),
      criterion4: criterionScoreOf(evaluation, 4),
      criterion5: criterionScoreOf(evaluation, 5),
      criterion6: criterionScoreOf(evaluation, 6),
      criterion7: criterionScoreOf(evaluation, 7),
      criterion8: criterionScoreOf(evaluation, 8),
      criterion9: criterionScoreOf(evaluation, 9),
      criterion10: criterionScoreOf(evaluation, 10),
    },
  };

  for (const key of Object.values(PLACEHOLDERS)) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) payload[key] = '';
  }
  return payload;
}

function missingRequiredIdentityFields(payload = {}) {
  return REQUIRED_IDENTITY_FIELDS.filter((key) => !textOrEmpty(payload[key]));
}

function missingRequiredCompleteFields(payload = {}) {
  const missing = REQUIRED_COMPLETE_FIELDS.filter((key) => {
    if (key === 'training_days' || key === 'absence_days') {
      return payload[key] == null || payload[key] === '';
    }
    return !textOrEmpty(payload[key]);
  });
  const grid = validateCriteriaGrid(payload);
  if (!grid.ok) missing.push(...grid.missing.filter((key) => !missing.includes(key)));
  if (grid.ok && Number(payload.professional_evaluation_total) !== grid.total) {
    missing.push('professional_evaluation_total');
  }
  return missing;
}

function publicPreviewPayload(payload = {}) {
  const out = {};
  for (const key of PREVIEW_PAYLOAD_KEYS) {
    out[key] = payload[key] == null ? '' : payload[key];
  }
  return out;
}

function identitySnapshot(payload = {}) {
  return publicPreviewPayload(payload);
}

function shouldReuseStoredPdf(previous, { regenerate = false } = {}) {
  const previousSnapshot = previous?.score_evidence_json?.templatePayload;
  const previousIdentityOk =
    previousSnapshot && missingRequiredIdentityFields(previousSnapshot).length === 0;
  return Boolean(previous?.pdf_file_id && !regenerate && previousIdentityOk);
}

module.exports = {
  DATA_INCOMPLETE_CODE,
  REQUIRED_IDENTITY_FIELDS,
  REQUIRED_COMPLETE_FIELDS,
  OPTIONAL_ORG_FIELDS,
  PREVIEW_PAYLOAD_KEYS,
  num,
  formatDate,
  academicPeriod,
  academicPeriodFromOpportunity,
  hostOrg,
  resolveStudentDisplayName,
  resolveStudentNumber,
  resolveSpecialtyLabel,
  summarizeAttendance,
  validateCriteriaGrid,
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredIdentityFields,
  missingRequiredCompleteFields,
  publicPreviewPayload,
  identitySnapshot,
  shouldReuseStoredPdf,
};
