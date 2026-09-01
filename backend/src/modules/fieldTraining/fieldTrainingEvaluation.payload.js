'use strict';

const crypto = require('crypto');
const {
  PLACEHOLDERS,
  DATA_INCOMPLETE_CODE,
  ELIGIBLE_OFFICIAL_TRAINING_DAYS,
  TRAINING_HOURS_DISPLAY_MODE,
} = require('./fieldTrainingEvaluation.constants');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { toMissingFieldEntries } = require('./fieldTrainingEvaluation.missingFields');
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
  'training_hours_display',
  'absence_days',
  'organization_name',
  'organization_department',
  'organization_email',
  'organization_phone',
  'organization_address',
  'general_comments',
  'field_supervisor_name',
  'responsible_person_name',
  'evaluation_date',
  'field_supervisor_date',
  'academic_supervisor_date',
  'eligibility_status',
  'professional_evaluation_total',
]);

const OPTIONAL_ORG_FIELDS = Object.freeze(['organization_fax']);

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
  'training_hours_display',
  'absence_days',
  'attendance_percentage',
  'organization_name',
  'organization_department',
  'organization_email',
  'organization_phone',
  'organization_fax',
  'organization_address',
  'criterion_1_score',
  'criterion_2_score',
  'criterion_3_score',
  'criterion_4_score',
  'criterion_5_score',
  'criterion_6_score',
  'criterion_7_score',
  'criterion_8_score',
  'criterion_9_score',
  'criterion_10_score',
  'professional_evaluation_total',
  'eligibility_status',
  'eligibility_reasons',
  'general_comments',
  'field_supervisor_name',
  'responsible_person_name',
  'academic_supervisor_name',
  'evaluation_date',
  'field_supervisor_date',
  'academic_supervisor_date',
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
  return textOrEmpty(value);
}

function formatOfficialDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${day} / ${m} / ${y}`;
}

function formatDate(value) {
  return formatOfficialDate(value);
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
    return { semester: 'الصيفي', academicYear: `${year - 1}-${year}` };
  }
  if (month >= 9) return { semester: 'الفصل الأول', academicYear: `${year}-${year + 1}` };
  if (month <= 1) return { semester: 'الفصل الأول', academicYear: `${year - 1}-${year}` };
  return { semester: 'الفصل الثاني', academicYear: `${year - 1}-${year}` };
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
    address: raw.address || raw.organization_address || '',
    organizationName: raw.organization_name || raw.organizationName || '',
    contactPerson:
      raw.contact_person ||
      raw.contactPerson ||
      raw.contact_name ||
      opportunity.contact_person ||
      '',
    fieldSupervisorName:
      raw.field_supervisor_name ||
      raw.fieldSupervisorName ||
      '',
    semester: raw.semester || '',
    academicYear: raw.academic_year || raw.academicYear || '',
    trainingHoursDisplayMode:
      raw.trainingHoursDisplayMode ||
      raw.training_hours_display_mode ||
      '',
    academicSupervisorRequired: raw.academic_supervisor_required === true,
    faxOptional: raw.fax_optional !== false,
  };
}

function resolveHoursDisplayMode(opportunity = {}, templateConfig = {}) {
  const org = hostOrg(opportunity);
  const configured =
    templateConfig.trainingHoursDisplayMode ||
    org.trainingHoursDisplayMode ||
    opportunity.trainingHoursDisplayMode;
  if (configured === TRAINING_HOURS_DISPLAY_MODE.DAILY_HOURS) {
    return TRAINING_HOURS_DISPLAY_MODE.DAILY_HOURS;
  }
  if (configured === TRAINING_HOURS_DISPLAY_MODE.TOTAL_COMPLETED_HOURS) {
    return TRAINING_HOURS_DISPLAY_MODE.TOTAL_COMPLETED_HOURS;
  }
  if (templateConfig.fillMode === 'label_form' || templateConfig.mutahOfficial) {
    return TRAINING_HOURS_DISPLAY_MODE.TOTAL_COMPLETED_HOURS;
  }
  return TRAINING_HOURS_DISPLAY_MODE.TOTAL_COMPLETED_HOURS;
}

function applicationOrg(application = {}) {
  const raw =
    application.host_organization && typeof application.host_organization === 'object'
      ? application.host_organization
      : application.organization && typeof application.organization === 'object'
        ? application.organization
        : {};
  return {
    organizationName:
      application.organization_name ||
      raw.organization_name ||
      raw.organizationName ||
      '',
    department:
      application.organization_department ||
      raw.department ||
      raw.organization_department ||
      '',
    email:
      application.organization_email ||
      raw.email ||
      raw.organization_email ||
      '',
    phone:
      application.organization_phone ||
      raw.phone ||
      raw.organization_phone ||
      '',
    fax:
      application.organization_fax ||
      raw.fax ||
      raw.organization_fax ||
      '',
    address:
      application.organization_address ||
      raw.address ||
      raw.organization_address ||
      '',
    fieldSupervisorName:
      application.field_supervisor_name ||
      raw.field_supervisor_name ||
      raw.fieldSupervisorName ||
      '',
  };
}

function resolveFieldSupervisorName({ application = {}, opportunity = {} } = {}) {
  const appOrg = applicationOrg(application);
  const org = hostOrg(opportunity);
  return (
    textOrEmpty(appOrg.fieldSupervisorName) ||
    textOrEmpty(org.fieldSupervisorName) ||
    textOrEmpty(org.contactPerson)
  );
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
  const uniqueRows = (source) => {
    const seen = new Set();
    return source.filter((row, index) => {
      const key =
        row.session_id ||
        row.field_training_sessions?.id ||
        row.field_training_sessions?.session_date ||
        row.session?.id ||
        row.session?.session_date ||
        `row-${index}`;
      if (seen.has(String(key))) return false;
      seen.add(String(key));
      return true;
    });
  };
  const attendedRows = uniqueRows(rows.filter((row) => ATTENDED_STATUSES.has(row.status)));
  const absentRows = uniqueRows(rows.filter((row) => row.status === 'absent'));
  const attendanceDataLoaded = rows.length > 0;
  const absenceDays = attendanceDataLoaded ? absentRows.length : null;
  const attendedDays = attendanceDataLoaded ? attendedRows.length : null;
  const storedHours = num(application.completed_training_hours);
  const recordedHoursKnown = Boolean(
    application.hours_updated_at ||
      application.hours_updated_by_id ||
      (storedHours != null && storedHours > 0)
  );
  const allAttendedDurationsKnown = attendedRows.every((row) => {
    const session = row.field_training_sessions || row.session || null;
    return hoursMod.sessionDurationMinutes(session?.start_time, session?.end_time) != null;
  });
  const derivedHoursKnown = attendanceDataLoaded && allAttendedDurationsKnown;
  const derivedHours = derivedHoursKnown
    ? hoursMod.minutesToHours(hoursMod.sumCompletedMinutesFromRecords(rows))
    : null;
  const candidates = [
    recordedHoursKnown ? storedHours : null,
    derivedHoursKnown ? derivedHours : null,
  ].filter((value) => value != null);
  const actualHours = candidates.length ? Math.max(...candidates) : null;
  const dailyHours =
    attendedDays > 0 && actualHours != null
      ? Math.round((Number(actualHours) / attendedDays) * 10) / 10
      : null;
  const attendancePercentage = num(application.attendance_percentage);
  return {
    attendedDays,
    absenceDays,
    actualHours,
    actualDailyHours: dailyHours,
    attendancePercentage,
    attendanceDataLoaded,
    hoursDataLoaded: actualHours != null,
  };
}

function statusLabelAr(status) {
  if (status === 'PASSED') return 'ناجح';
  if (status === 'FAILED') return 'راسب';
  if (status === 'NOT_ELIGIBLE') return 'غير مؤهل';
  return textOrEmpty(status);
}

function isEligibleEvaluationStatus(evaluation = {}, application = {}) {
  const raw =
    textOrEmpty(evaluation.eligibilityStatus) ||
    textOrEmpty(application.completion_eligibility_status);
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === 'eligible';
}

function resolveTrainingDaysForPayload(hours, evaluation = {}, application = {}) {
  if (isEligibleEvaluationStatus(evaluation, application)) {
    return ELIGIBLE_OFFICIAL_TRAINING_DAYS;
  }
  return hours.attendedDays;
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
  academicSupervisorName = null,
  templateConfig = {},
} = {}) {
  const period = academicPeriodFromOpportunity(opportunity);
  const appOrg = applicationOrg(application);
  const org = hostOrg(opportunity);
  const hours = summarizeAttendance(attendanceRows, application);
  const studentNumber = resolveStudentNumber(student);
  const hoursMode = resolveHoursDisplayMode(opportunity, templateConfig);
  const trainingHoursDisplay =
    hoursMode === TRAINING_HOURS_DISPLAY_MODE.DAILY_HOURS
      ? hours.actualDailyHours == null
        ? null
        : hours.actualDailyHours
      : hours.actualHours;
  const reasons = Array.isArray(evaluation.eligibilityReasons)
    ? evaluation.eligibilityReasons
    : [];
  const reasonTexts = Array.isArray(evaluation.eligibilityReasonLabels)
    ? evaluation.eligibilityReasonLabels
    : reasons.map((code) => evaluation.reasonLabels?.[code] || code).filter(Boolean);
  const criteriaCheck = validateCriteriaGrid(evaluation);
  const professionalTotal =
    criteriaCheck.ok ? criteriaCheck.total : null;
  const academicName =
    textOrEmpty(academicSupervisorName) ||
    textOrEmpty(application.academic_supervisor_name) ||
    textOrEmpty(evaluation.academicSupervisorName);
  const evaluationDate = formatOfficialDate(
    evaluation.evaluationDate || evaluation.finalizedAt || evaluation.finalized_at
  );
  const fieldSupervisorDate = formatOfficialDate(evaluation.fieldSupervisorDate) || evaluationDate;
  const academicSupervisorDate =
    formatOfficialDate(evaluation.academicSupervisorDate) || evaluationDate;
  const eligibilityStatus = textOrEmpty(evaluation.eligibilityStatus) || textOrEmpty(application.completion_eligibility_status);

  const payload = {
    student_name: resolveStudentDisplayName(student),
    student_number: studentNumber,
    student_specialty: textOrEmpty(specialtyLabel) || resolveSpecialtyLabel(student),
    semester: textOrEmpty(org.semester) || period.semester,
    academic_year: textOrEmpty(org.academicYear) || period.academicYear,
    training_start_date: formatOfficialDate(
      application.training_start_date || opportunity.start_date
    ),
    training_end_date: formatOfficialDate(
      application.training_end_date || opportunity.end_date
    ),
    training_days: resolveTrainingDaysForPayload(hours, evaluation, application),
    actual_training_hours: hours.actualHours,
    actual_daily_hours: hours.actualDailyHours,
    training_hours_display:
      trainingHoursDisplay === '' || trainingHoursDisplay == null ? null : trainingHoursDisplay,
    absence_days: hours.absenceDays,
    attendance_percentage: hours.attendancePercentage,
    organization_name:
      textOrEmpty(appOrg.organizationName) ||
      textOrEmpty(opportunity.organization_name) ||
      textOrEmpty(org.organizationName),
    organization_department:
      optionalOrgValue(appOrg.department) || optionalOrgValue(org.department),
    organization_email: optionalOrgValue(appOrg.email) || optionalOrgValue(org.email),
    organization_phone: optionalOrgValue(appOrg.phone) || optionalOrgValue(org.phone),
    organization_fax: optionalOrgValue(appOrg.fax) || optionalOrgValue(org.fax),
    organization_address: optionalOrgValue(appOrg.address) || optionalOrgValue(org.address),
    completion_status: textOrEmpty(application.completion_eligibility_status),
    eligibility_status: eligibilityStatus,
    final_status: statusLabelAr(evaluation.finalStatus),
    final_score: evaluation.finalScore == null ? '' : evaluation.finalScore,
    final_percentage: evaluation.finalPercentage == null ? '' : evaluation.finalPercentage,
    professional_evaluation_total: professionalTotal,
    professional_evaluation_percentage:
      evaluation.professionalPercentage == null ? '' : evaluation.professionalPercentage,
    general_comments: evaluation.generalComments || evaluation.autoComment || '',
    field_supervisor_name: resolveFieldSupervisorName({ application, opportunity, instructor }),
    academic_supervisor_name: academicName,
    responsible_person_name: academicName,
    evaluation_date: evaluationDate,
    field_supervisor_date: fieldSupervisorDate,
    academic_supervisor_date: academicSupervisorDate,
    eligibility_reasons: reasonTexts.filter(Boolean).join('\n'),
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
  const numericOk = new Set(['training_days', 'absence_days', 'training_hours_display', 'actual_training_hours']);
  const missing = REQUIRED_COMPLETE_FIELDS.filter((key) => {
    if (numericOk.has(key)) {
      return payload[key] == null || payload[key] === '';
    }
    return !textOrEmpty(payload[key]);
  });
  const grid = validateCriteriaGrid(payload);
  if (!grid.ok) missing.push(...grid.missing.filter((key) => !missing.includes(key)));
  if (grid.ok && Number(payload.professional_evaluation_total) !== grid.total) {
    missing.push('professional_evaluation_total');
  }
  if (
    String(payload.eligibility_status || '').toUpperCase() === 'NOT_ELIGIBLE' &&
    !textOrEmpty(payload.eligibility_reasons) &&
    !missing.includes('eligibility_reasons')
  ) {
    missing.push('eligibility_reasons');
  }
  return missing;
}

function missingFieldEntries(payload = {}) {
  return toMissingFieldEntries(missingRequiredCompleteFields(payload));
}

function snapshotFields(payload = {}) {
  const keys = [
    'student_name',
    'student_number',
    'student_specialty',
    'semester',
    'academic_year',
    'training_start_date',
    'training_end_date',
    'training_days',
    'actual_training_hours',
    'training_hours_display',
    'absence_days',
    'organization_name',
    'organization_department',
    'organization_email',
    'organization_phone',
    'organization_fax',
    'organization_address',
    'criterion_1_score',
    'criterion_2_score',
    'criterion_3_score',
    'criterion_4_score',
    'criterion_5_score',
    'criterion_6_score',
    'criterion_7_score',
    'criterion_8_score',
    'criterion_9_score',
    'criterion_10_score',
    'professional_evaluation_total',
    'eligibility_status',
    'eligibility_reasons',
    'general_comments',
    'academic_supervisor_name',
    'field_supervisor_name',
    'responsible_person_name',
    'evaluation_date',
    'field_supervisor_date',
    'academic_supervisor_date',
  ];
  const out = {};
  for (const key of keys) out[key] = payload[key] == null ? '' : payload[key];
  return out;
}

function templatePayloadHash(payload = {}, template = {}) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        templateId: template.id || payload.template_id || '',
        templateVersion: template.version || payload.template_version || '',
        sourceTemplateFileId:
          template.original_file_id ||
          template.originalFileId ||
          payload.source_template_file_id ||
          '',
        snapshot: snapshotFields(payload),
      })
    )
    .digest('hex');
}

function publicPreviewPayload(payload = {}) {
  const out = {};
  for (const key of PREVIEW_PAYLOAD_KEYS) {
    out[key] = payload[key] == null ? '' : payload[key];
  }
  return out;
}

function identitySnapshot(payload = {}) {
  return snapshotFields(payload);
}

function shouldReuseStoredPdf(previous, { regenerate = false, sourceHash = null } = {}) {
  if (!previous?.pdf_file_id || regenerate) return false;
  const previousSnapshot = previous?.score_evidence_json?.templatePayload;
  const previousIdentityOk =
    previousSnapshot && missingRequiredIdentityFields(previousSnapshot).length === 0;
  if (!previousIdentityOk) return false;
  if (sourceHash) {
    return Boolean(
      previous?.score_evidence_json?.sourceHash === sourceHash &&
        previous?.score_evidence_json?.sourceTemplateFileId &&
        previous?.score_evidence_json?.fidelity &&
        Number(previous?.score_evidence_json?.generatedPageCount) === 2
    );
  }
  return false;
}

module.exports = {
  DATA_INCOMPLETE_CODE,
  REQUIRED_IDENTITY_FIELDS,
  REQUIRED_COMPLETE_FIELDS,
  OPTIONAL_ORG_FIELDS,
  PREVIEW_PAYLOAD_KEYS,
  num,
  formatDate,
  formatOfficialDate,
  academicPeriod,
  academicPeriodFromOpportunity,
  hostOrg,
  resolveHoursDisplayMode,
  resolveFieldSupervisorName,
  resolveStudentDisplayName,
  resolveStudentNumber,
  resolveSpecialtyLabel,
  summarizeAttendance,
  validateCriteriaGrid,
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredIdentityFields,
  missingRequiredCompleteFields,
  missingFieldEntries,
  publicPreviewPayload,
  identitySnapshot,
  snapshotFields,
  templatePayloadHash,
  shouldReuseStoredPdf,
};
