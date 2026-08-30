'use strict';

const ExcelJS = require('exceljs');
const dates = require('./fieldTrainingReport.dates');
const labels = require('./fieldTrainingReport.labels');
const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');
const { formatCompletedHoursLabelAr } = require('./fieldTraining.hours');

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
  'م',
  'اسم الطالب',
  'الرقم الجامعي',
  'المشرف الأكاديمي',
  'البريد الإلكتروني الجامعي',
  'التخصص',
  'الجامعة',
  'فرصة التدريب',
  'جهة التدريب',
  'حالة الطلب',
  'حالة التدريب',
  'تقدم المهمات',
  'حالة التقييم البعدي',
  'درجة التقييم البعدي',
  'حالة الأهلية',
  'الساعات التدريبية المنجزة',
  'النتيجة النهائية',
  'تاريخ التقديم',
]);

const COLUMN_WIDTHS = [6, 26, 18, 22, 30, 22, 22, 28, 24, 16, 22, 28, 22, 18, 18, 28, 16, 18];
const UNIVERSITY_NUMBER_COL = 3;
const SUPERVISOR_COL = 4;
const COMPLETED_HOURS_COL = 16;
const FINAL_RESULT_COL = 17;

const FINAL_STATUS_AR = Object.freeze({
  PASSED: 'ناجح',
  FAILED: 'راسب',
  NOT_ELIGIBLE: 'غير مؤهل',
});

function finalResultLabel(status) {
  if (!status) return '';
  return FINAL_STATUS_AR[status] || '';
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
  return {
    seq: index + 1,
    studentName: textOrEmpty(source.student_name),
    universityNumber: extractUniversityNumberFromEmail(email),
    academicSupervisor: textOrEmpty(source.academic_supervisor_name || source.academicSupervisor),
    email,
    specialty: textOrEmpty(source.specialty_label || source.university_specialty_label),
    university: textOrEmpty(source.university_name || source.student_university),
    opportunity: textOrEmpty(source.opportunity_title),
    hostOrganization: textOrEmpty(source.training_organization || source.organization_name),
    applicationStatus: applicationStatusLabel(source.application_status || source.status),
    trainingStatus: trainingStatusLabel(source.training_status),
    taskProgress: textOrEmpty(source.task_progress?.display || source.task_progress_display),
    postAssessmentStatus: textOrEmpty(
      source.post_assessment_attempt_status_label || source.post_assessment_status_label
    ),
    postAssessmentScore:
      source.post_assessment_score != null && source.post_assessment_score !== ''
        ? Number(source.post_assessment_score)
        : '',
    eligibilityStatus: eligibilityStatusLabel(
      source.eligibility_status || source.completion_eligibility_status
    ),
    completedHoursLabel: formatCompletedHoursLabelAr(
      source.completed_training_hours ?? source.completedHours
    ),
    finalResult: finalResultLabel(source.final_evaluation_status),
    submittedAt: dates.formatReportDateAr(source.submitted_at || source.created_at) || '',
  };
}

function toCellArray(row) {
  return [
    row.seq,
    row.studentName,
    row.universityNumber,
    row.academicSupervisor,
    row.email,
    row.specialty,
    row.university,
    row.opportunity,
    row.hostOrganization,
    row.applicationStatus,
    row.trainingStatus,
    row.taskProgress,
    row.postAssessmentStatus,
    row.postAssessmentScore,
    row.eligibilityStatus,
    row.completedHoursLabel,
    row.finalResult,
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
    excelRow.getCell(FINAL_RESULT_COL).value = mapped.finalResult;
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
  COMPLETED_HOURS_COL,
  FINAL_RESULT_COL,
  FINAL_STATUS_AR,
  mapStudentExcelRow,
  buildStudentsExcelFilename,
  exportFieldTrainingStudentsExcel,
};
