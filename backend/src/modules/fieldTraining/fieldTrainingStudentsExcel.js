'use strict';

const ExcelJS = require('exceljs');
const dates = require('./fieldTrainingReport.dates');
const labels = require('./fieldTrainingReport.labels');
const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');
const hoursMod = require('./fieldTraining.hours');

const NAVY = 'FF132D4A';
const GOLD = 'FFC9A227';
const WHITE = 'FFFFFFFF';
const ALT_ROW = 'FFF7F1E7';
const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
const GOLD_BORDER = { style: 'medium', color: { argb: GOLD } };

const SHEET_NAME = 'طلاب التدريب الميداني';

const COLUMN_HEADERS = Object.freeze([
  '#',
  'اسم الطالب',
  'الرقم الجامعي',
  'البريد الإلكتروني',
  'التخصص',
  'المشرف الأكاديمي',
  'الجامعة',
  'فرصة التدريب',
  'جهة التدريب',
  'نمط التدريب',
  'حالة الطلب',
  'حالة التدريب',
  'نتيجة التدريب',
  'العلامة النهائية',
  'نسبة الحضور',
  'علامة الحضور من 20',
  'التقييم البعدي',
  'علامة التقييم البعدي من 20',
  'التاسكات المطلوبة',
  'التاسكات المسلمة',
  'التاسكات التي تم تقييمها',
  'تقدم التاسكات',
  'علامة التاسكات من 40',
  'علامة السلوك والالتزام من 20',
  'الساعات المنجزة',
  'سبب عدم التأهيل',
  'تاريخ التقديم',
]);

const COLUMN_WIDTHS = [6, 26, 18, 28, 22, 22, 22, 28, 24, 14, 16, 18, 16, 16, 14, 16, 16, 16, 14, 14, 16, 28, 16, 18, 22, 42, 18];
const UNIVERSITY_NUMBER_COL = 3;
const SUPERVISOR_COL = 6;
const FINAL_RESULT_COL = 13;

const ELIGIBILITY_EXPORT_AR = Object.freeze({
  eligible: 'مؤهل',
  ineligible: 'غير مؤهل',
  not_eligible: 'غير مؤهل',
  needs_review: 'قيد الاستكمال',
  pending: 'قيد الاستكمال',
  ELIGIBLE: 'مؤهل',
  NOT_ELIGIBLE: 'غير مؤهل',
  NEEDS_REVIEW: 'قيد الاستكمال',
  INCOMPLETE: 'قيد الاستكمال',
});

function eligibilityExportLabel(status) {
  if (!status) return '';
  return ELIGIBILITY_EXPORT_AR[status] || labels.labelOf(labels.ELIGIBILITY_AR, status, '');
}

function qualificationReasons(source) {
  const reason = source.eligibility_reason || source.qualification?.eligibilityReasonLabels;
  if (Array.isArray(source.qualification?.eligibilityReasonLabels)) {
    return source.qualification.eligibilityReasonLabels.filter(Boolean).join(' · ');
  }
  if (Array.isArray(reason?.labelsAr)) return reason.labelsAr.filter(Boolean).join(' · ');
  if (Array.isArray(reason?.reasons)) return reason.reasons.filter(Boolean).join(' · ');
  return '';
}

function pointsOf(source, path, fallbackKey) {
  const components = source.qualification?.scoreComponents || source.scoreComponents || {};
  const nested = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), components);
  if (nested != null && nested !== '') return nested;
  if (source[fallbackKey] != null && source[fallbackKey] !== '') return source[fallbackKey];
  return '';
}

function applicationStatusLabel(status) {
  return labels.labelOf(labels.APPLICATION_STATUS_AR, status, '');
}

function trainingStatusLabel(status) {
  return labels.labelOf(labels.TRAINING_STATUS_AR, status, '');
}

function eligibilityStatusLabel(status) {
  return labels.labelOf(labels.ELIGIBILITY_AR, status, '');
}

function textOrEmpty(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null') return '';
  return text;
}

/**
 * Map one application (+ optional current evaluation) to Excel display values.
 * Academic supervisor comes from the canonical assignment, never from Excel-only text.
 */
function mapStudentExcelRow(source, index) {
  const email = textOrEmpty(source.student_email);
  const requiredTasks =
    source.requiredTaskCount ??
    source.qualification?.scoreComponents?.tasks?.requiredCount ??
    source.task_progress?.total_required ??
    null;
  const submittedTasks =
    source.submittedTaskCount ??
    source.qualification?.scoreComponents?.tasks?.submittedCount ??
    source.task_progress?.submitted_required ??
    source.tasks_submitted ??
    null;
  const evaluatedTasks =
    source.gradedTaskCount ??
    source.qualification?.scoreComponents?.tasks?.acceptedCount ??
    source.task_progress?.evaluated_required ??
    source.tasks_graded ??
    null;
  const trainingMode = labels.labelOf(
    labels.TRAINING_MODE_AR,
    source.training_mode || source.trainingMode,
    ''
  );
  const trainingResult = eligibilityExportLabel(
    source.officialResult?.eligibilityDb ||
      source.qualification?.workflowOutcome ||
      source.qualification?.eligibilityStatus ||
      source.eligibility_status ||
      source.completion_eligibility_status
  );
  return {
    seq: index + 1,
    studentName: textOrEmpty(source.student_name),
    universityNumber: extractUniversityNumberFromEmail(email),
    email,
    specialty: textOrEmpty(source.specialty_label || source.university_specialty_label),
    academicSupervisor: textOrEmpty(source.academic_supervisor_name || source.academicSupervisor),
    university: textOrEmpty(source.university_name || source.student_university),
    opportunity: textOrEmpty(source.opportunity_title),
    hostOrganization: textOrEmpty(source.training_organization || source.organization_name),
    trainingMode,
    applicationStatus: applicationStatusLabel(source.application_status || source.status),
    trainingStatus: trainingStatusLabel(source.training_status),
    trainingResult,
    eligibilityStatus: trainingResult,
    finalScore:
      source.officialResult?.finalScore ??
      source.qualification?.finalScore ??
      source.qualification?.approvedFinalScore ??
      source.final_score ??
      '',
    attendancePercent:
      source.officialResult?.attendancePercentage ??
      source.qualification?.scoreComponents?.attendance?.effectivePercentage ??
      source.attendance_percentage ??
      '',
    attendancePoints:
      source.qualification?.scoreBreakdown?.attendancePoints ??
      pointsOf(source, 'attendance.points', 'attendance_points'),
    postAssessmentStatus: textOrEmpty(
      source.post_assessment_attempt_status_label || source.post_assessment_status_label
    ),
    postAssessmentPoints:
      source.qualification?.scoreBreakdown?.postAssessmentPoints ??
      pointsOf(source, 'postAssessment.points', 'post_assessment_points'),
    requiredTasks: requiredTasks ?? '',
    tasksSubmitted: submittedTasks ?? '',
    tasksEvaluated: evaluatedTasks ?? '',
    taskProgress: textOrEmpty(source.task_progress?.display || source.task_progress_display),
    tasksPoints:
      source.qualification?.scoreBreakdown?.taskPoints ??
      pointsOf(source, 'tasks.points', 'tasks_points'),
    behaviorPoints:
      source.qualification?.scoreBreakdown?.behaviorPoints ??
      pointsOf(source, 'behavior.points', 'behavior_points'),
    completedHoursLabel: (() => {
      const hours =
        source.completed_training_hours ?? source.training_hours?.completed_training_hours;
      if (hours == null || hours === '') return '';
      return hoursMod.formatCompletedHoursLabelAr(hours);
    })(),
    ineligibilityReason: qualificationReasons(source),
    submittedAt: dates.formatReportDateAr(source.submitted_at || source.created_at) || '',
  };
}

function toCellArray(row) {
  return [
    row.seq,
    row.studentName,
    row.universityNumber,
    row.email,
    row.specialty,
    row.academicSupervisor,
    row.university,
    row.opportunity,
    row.hostOrganization,
    row.trainingMode,
    row.applicationStatus,
    row.trainingStatus,
    row.trainingResult,
    row.finalScore,
    row.attendancePercent,
    row.attendancePoints,
    row.postAssessmentStatus,
    row.postAssessmentPoints,
    row.requiredTasks,
    row.tasksSubmitted,
    row.tasksEvaluated,
    row.taskProgress,
    row.tasksPoints,
    row.behaviorPoints,
    row.completedHoursLabel,
    row.ineligibilityReason,
    row.submittedAt,
  ];
}

function sanitizeFilenamePart(value) {
  const text = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return text.slice(0, 48);
}

function buildStudentsExcelFilename({ opportunityTitle, stamp } = {}) {
  const datePart = stamp || dates.formatReportDate(new Date()) || 'export';
  const opp = sanitizeFilenamePart(opportunityTitle);
  if (opp) return `طلاب_التدريب_الميداني_${opp}_${datePart}.xlsx`;
  return `طلاب_التدريب_الميداني_${datePart}.xlsx`;
}

async function exportFieldTrainingStudentsExcel(sources, { opportunityTitle } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET_NAME);
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  ws.addRow([...COLUMN_HEADERS]);

  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: GOLD } },
      left: { style: 'thin', color: { argb: GOLD } },
      bottom: GOLD_BORDER,
      right: { style: 'thin', color: { argb: GOLD } },
    };
  });

  sources.forEach((source, index) => {
    const mapped = mapStudentExcelRow(source, index);
    const excelRow = ws.addRow(toCellArray(mapped));
    excelRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'right' };
    excelRow.height = 20;
    if (index % 2 === 1) {
      excelRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };
      });
    }
    const uniCell = excelRow.getCell(UNIVERSITY_NUMBER_COL);
    uniCell.numFmt = '@';
    if (mapped.universityNumber) uniCell.value = String(mapped.universityNumber);
    excelRow.getCell(SUPERVISOR_COL).value = mapped.academicSupervisor || '';
    excelRow.getCell(FINAL_RESULT_COL).value = mapped.trainingResult || '';
  });

  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMN_HEADERS.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: buildStudentsExcelFilename({ opportunityTitle }),
    rowCount: sources.length,
  };
}

module.exports = {
  SHEET_NAME,
  COLUMN_HEADERS,
  UNIVERSITY_NUMBER_COL,
  SUPERVISOR_COL,
  ELIGIBILITY_EXPORT_AR,
  mapStudentExcelRow,
  buildStudentsExcelFilename,
  exportFieldTrainingStudentsExcel,
};
