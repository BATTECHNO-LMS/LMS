'use strict';

const { PLACEHOLDERS } = require('./fieldTrainingEvaluation.constants');
const { resolveUniversityNumber } = require('./fieldTrainingEvaluation.filename');
const hoursMod = require('./fieldTraining.hours');

const DATA_INCOMPLETE_CODE = 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE';

const REQUIRED_IDENTITY_FIELDS = Object.freeze([
  'student_name',
  'student_number',
  'student_specialty',
  'training_start_date',
  'training_end_date',
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
  };
}

function resolveStudentDisplayName(student = {}) {
  return textOrEmpty(student.full_name || student.fullName);
}

function resolveStudentNumber(student = {}) {
  const resolved = resolveUniversityNumber(student);
  if (!resolved || resolved === 'NA') return '';
  return resolved;
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
    organization_department: org.department,
    organization_email: org.email,
    organization_phone: org.phone,
    organization_fax: org.fax,
    organization_address: org.address,
    completion_status: textOrEmpty(application.completion_eligibility_status),
    final_status: statusLabelAr(evaluation.finalStatus),
    final_score: evaluation.finalScore == null ? '' : evaluation.finalScore,
    final_percentage: evaluation.finalPercentage == null ? '' : evaluation.finalPercentage,
    professional_evaluation_total:
      evaluation.professionalTotal == null ? '' : evaluation.professionalTotal,
    professional_evaluation_percentage:
      evaluation.professionalPercentage == null ? '' : evaluation.professionalPercentage,
    general_comments: evaluation.generalComments || evaluation.autoComment || '',
    field_supervisor_name: instructor?.full_name || instructor?.fullName || '',
    responsible_person_name: instructor?.full_name || instructor?.fullName || '',
    evaluation_date: formatDate(evaluation.evaluationDate || new Date()),
    eligibility_reasons: reasons
      .map((code) => evaluation.reasonLabels?.[code] || code)
      .filter(Boolean)
      .join('؛ '),
    criterion_1_score: evaluation.criterion1Score,
    criterion_2_score: evaluation.criterion2Score,
    criterion_3_score: evaluation.criterion3Score,
    criterion_4_score: evaluation.criterion4Score,
    criterion_5_score: evaluation.criterion5Score,
    criterion_6_score: evaluation.criterion6Score,
    criterion_7_score: evaluation.criterion7Score,
    criterion_8_score: evaluation.criterion8Score,
    criterion_9_score: evaluation.criterion9Score,
    criterion_10_score: evaluation.criterion10Score,
    criteria: {
      criterion1: evaluation.criterion1Score,
      criterion2: evaluation.criterion2Score,
      criterion3: evaluation.criterion3Score,
      criterion4: evaluation.criterion4Score,
      criterion5: evaluation.criterion5Score,
      criterion6: evaluation.criterion6Score,
      criterion7: evaluation.criterion7Score,
      criterion8: evaluation.criterion8Score,
      criterion9: evaluation.criterion9Score,
      criterion10: evaluation.criterion10Score,
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

module.exports = {
  DATA_INCOMPLETE_CODE,
  REQUIRED_IDENTITY_FIELDS,
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
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredIdentityFields,
  publicPreviewPayload,
  identitySnapshot,
};
