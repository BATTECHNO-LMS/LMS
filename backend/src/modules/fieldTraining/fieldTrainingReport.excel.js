'use strict';

const ExcelJS = require('exceljs');
const metrics = require('./fieldTrainingReport.metrics');
const labels = require('./fieldTrainingReport.labels');
const dates = require('./fieldTrainingReport.dates');
const hoursMod = require('./fieldTraining.hours');

const NAVY = 'FF132D4A';
const WHITE = 'FFFFFFFF';
const ALT_ROW = 'FFF7F1E7';
const GREEN = 'FF2F6B4F';
const ORANGE = 'FFB76E1F';
const RED = 'FFA33B3B';
const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

function setupRtlSheet(ws, freeze = 1) {
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: freeze }];
}

function styleHeaderRow(ws, rowNum, colCount) {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 22;
}

function paintAlt(row, index) {
  if (index % 2 !== 1) return;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };
  });
}

function excelCellValue(value) {
  if (value == null || value === '') return metrics.NA;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : String(value);
  }
  return String(value);
}

function addKeyValueSheet(wb, name, title, rows) {
  const ws = wb.addWorksheet(name);
  setupRtlSheet(ws, 2);
  ws.addRow([title]);
  ws.getRow(1).font = { ...AR_FONT, bold: true, size: 14, color: { argb: NAVY } };
  ws.addRow(['الحقل', 'القيمة']);
  styleHeaderRow(ws, 2, 2);
  rows.forEach(([key, value], index) => {
    const excelRow = ws.addRow([key, excelCellValue(value)]);
    paintAlt(excelRow, index);
  });
  ws.columns = [{ width: 36 }, { width: 48 }];
  ws.autoFilter = { from: 'A2', to: 'B2' };
  return ws;
}

function addTableSheet(wb, name, headers, rows, { percentCols = [], numberCols = [] } = {}) {
  const ws = wb.addWorksheet(name);
  setupRtlSheet(ws, 1);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);
  rows.forEach((data, index) => {
    const excelRow = ws.addRow(data.map((c) => excelCellValue(c)));
    paintAlt(excelRow, index);
    excelRow.alignment = { wrapText: true, vertical: 'middle' };
    percentCols.forEach((col) => {
      const cell = excelRow.getCell(col);
      if (typeof cell.value === 'number') cell.numFmt = '0.00"%"';
    });
    numberCols.forEach((col) => {
      const cell = excelRow.getCell(col);
      if (typeof cell.value === 'number') cell.numFmt = '0.00';
    });
  });
  ws.columns = headers.map(() => ({ width: 18 }));
  if (headers.length) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }
  return ws;
}

function applyStatusFill(ws, colIndex, startRow, rowCount, mapFn) {
  for (let i = 0; i < rowCount; i += 1) {
    const cell = ws.getRow(startRow + i).getCell(colIndex);
    const tone = mapFn(cell.value);
    if (!tone) continue;
    cell.font = { ...AR_FONT, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone } };
  }
}

async function exportUniversityReportExcel(report, options = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';
  wb.created = new Date();
  const summary = report.summary || {};
  const meta = report.meta || {};
  const university = report.university || {};

  addKeyValueSheet(wb, '01_الملخص_التنفيذي', report.report_title, [
    ['الجامعة', university.name],
    ['الاسم الإنجليزي', university.name_en],
    ['الرمز', university.code],
    ['مرجع التقرير', meta.reference],
    ['الإصدار', meta.version],
    ['تاريخ الإنشاء', meta.generated_at_label || dates.formatReportDateTime(meta.generated_at)],
    ['أنشئ بواسطة', meta.generated_by_name],
    ['عوامل التصفية', JSON.stringify(report.filters || {})],
    ['إجمالي الطلاب', summary.total_applicants],
    ['المقبولون', summary.accepted_students],
    ['قيد التدريب', summary.in_training_students],
    ['مكتملون', summary.completed_students],
    ['غير مكتملين', summary.not_completed_students],
    ['معدل الإكمال %', summary.completion_rate],
    ['فرص مؤهلة', summary.eligible_opportunities],
    ['جهات تدريب نشطة', summary.active_training_organizations],
    ['متوسط الحضور %', summary.average_attendance],
    ['إجمالي الساعات', summary.total_training_hours],
    ['متوسط ساعات الطالب', summary.average_student_hours],
    ['متوسط إنجاز المهام %', summary.average_task_completion],
    ['متوسط التقييم القبلي', summary.average_pre_assessment_score],
    ['متوسط التقييم البعدي', summary.average_post_assessment_score],
    ['كتب إنهاء', summary.completion_letters_issued],
    ['حالات متابعة', summary.at_risk_students],
    ...(report.data_quality_warnings || []).map((w, i) => [`تنبيه جودة ${i + 1}`, w]),
  ]);

  addKeyValueSheet(wb, '02_معلومات_الجامعة', 'معلومات الجامعة', [
    ['الاسم بالعربية', university.name],
    ['الاسم بالإنجليزية', university.name_en],
    ['الرمز', university.code],
    ['الاسم المختصر', university.short_name],
    ['التخصصات', (university.specialties || []).map((s) => s.name_ar || s.name_en).join('، ')],
    ['عدد الطلاب المشاركين', university.participating_students],
    ['عدد المشرفين', university.instructors_count],
  ]);

  const students = report.students || [];
  const studentsWs = addTableSheet(
    wb,
    '03_الطلاب',
    [
      'الطالب',
      'البريد',
      'التخصص',
      'الفرصة',
      'جهة التدريب',
      'المشرف',
      'حالة الطلب',
      'حالة التدريب',
      'تقدم المهمات',
      'الحضور %',
      'ساعات مطلوبة',
      'ساعات منجزة',
      'ساعات متبقية',
      'إكمال الساعات %',
      'إنجاز المهام %',
      'قبلي',
      'بعدي',
      'حالة التقييم البعدي',
      'التقدم %',
      'الأهلية',
      'الشهادة',
    ],
    students.map((row) => [
      row.student_name,
      row.student_email,
      row.university_specialty_label,
      row.opportunity_title,
      row.training_organization,
      row.instructor_name,
      row.application_status_label || row.application_status,
      row.training_status_label || row.training_status,
      row.task_progress?.display || '',
      row.attendance_percentage,
      row.required_training_hours,
      row.completed_training_hours,
      row.remaining_training_hours,
      row.hours_completion_percentage,
      row.task_completion,
      row.pre_assessment_score,
      row.post_assessment_score,
      row.post_assessment_attempt_status_label || '',
      row.progress_percentage,
      row.eligibility_status_label || row.eligibility_status,
      row.completion_letter_status_label || row.completion_letter_status,
    ])
  );
  if (students.length) {
    const last = students.length + 1;
    studentsWs.getCell(`J${last + 1}`).value = { formula: `IF(COUNTA(J2:J${last})=0,"${metrics.NA}",AVERAGE(J2:J${last}))` };
    studentsWs.getCell(`A${last + 1}`).value = 'متوسط الحضور (مرجعي للعرض)';
  }

  addTableSheet(
    wb,
    '04_الفرص_التدريبية',
    ['الفرصة', 'جهة التدريب', 'المجال', 'السعة', 'الطلبات', 'المقبولون', 'نشطون', 'مكتملون', 'الإشغال %', 'الحالة', 'البداية', 'النهاية'],
    (report.opportunities?.rows || []).map((r) => [
      r.title,
      r.organization_name,
      r.field,
      r.capacity,
      r.applications,
      r.accepted_students,
      r.active_students,
      r.completed_students,
      r.utilization_rate,
      r.status_label,
      dates.formatReportDate(r.start_date),
      dates.formatReportDate(r.end_date),
    ])
  );

  addTableSheet(
    wb,
    '05_جهات_التدريب',
    ['الجهة', 'الطلاب', 'الفرص', 'المجالات', 'نشطون', 'مكتملون', 'معدل الإكمال %', 'متوسط الحضور %'],
    (report.organizations?.rows || []).map((r) => [
      r.name,
      r.hosted_students,
      r.opportunities,
      (r.domains || []).join('، '),
      r.active_students,
      r.completed_students,
      r.completion_rate,
      r.average_attendance,
    ])
  );

  addTableSheet(
    wb,
    '06_الحضور',
    ['التخصص', 'الطلاب', 'متوسط الحضور %', 'دون الحد'],
    (report.attendance?.by_specialty || []).map((r) => [r.label, r.students, r.average, r.below_threshold])
  );

  addKeyValueSheet(wb, '07_الساعات_التدريبية', 'الساعات التدريبية', [
    ['ساعات منجزة', report.hours?.total_attended_hours],
    ['ساعات مطلوبة', report.hours?.total_required_hours],
    ['ساعات مجدولة', report.hours?.total_scheduled_hours],
    ['المتوسط', report.hours?.average_hours],
    ['الوسيط', report.hours?.median_hours],
    ['الحد الأدنى', report.hours?.min_hours],
    ['الحد الأعلى', report.hours?.max_hours],
    ['مستوفون', report.hours?.meeting_required],
    ['دون المطلوب', report.hours?.below_required],
  ]);

  addKeyValueSheet(wb, '08_المهمات', 'المهمات', [
    ['إجمالي المهام', report.tasks?.total_tasks],
    ['التسليمات', report.tasks?.total_submissions],
    ['في الوقت', report.tasks?.on_time],
    ['متأخر', report.tasks?.late],
    ['بانتظار التقييم', report.tasks?.pending_grading],
    ['مجتازة', report.tasks?.passed],
    ['تحتاج تعديلاً', report.tasks?.revision_required],
    ['ناقصة', report.tasks?.missing_submissions],
    ['معدل التسليم %', report.tasks?.submission_rate],
  ]);

  const cmp = report.assessments?.comparison || {};
  addKeyValueSheet(wb, '09_الاختبارات', 'الاختبارات', [
    ['متوسط قبلي', report.assessments?.average_pre],
    ['متوسط بعدي', report.assessments?.average_post],
    ['الفرق بالنقاط المئوية', cmp.average_pp],
    ['تحسنوا', cmp.improved],
    ['ثابتون', cmp.unchanged],
    ['انخفضوا', cmp.decreased],
    ['ملاحظة', cmp.observation],
    ['تحفظ', cmp.caveat],
  ]);

  addTableSheet(
    wb,
    '10_التقدم',
    ['الفئة', 'العدد', 'النسبة %'],
    (report.progress?.distribution?.buckets || []).map((b) => [b.label, b.count, b.percentage])
  );

  addTableSheet(
    wb,
    '11_الإكمال',
    ['السبب', 'العدد'],
    (report.completion?.reasons || []).map((r) => [r.label, r.count])
  );

  addTableSheet(
    wb,
    '12_الشهادات',
    ['رقم الكتاب', 'تاريخ الإصدار', 'الحالة'],
    (report.certificates?.rows || []).map((r) => [
      r.letter_no,
      dates.formatReportDate(r.issued_at),
      labels.labelOf(labels.CERTIFICATE_AR, r.status),
    ])
  );

  addTableSheet(
    wb,
    '13_التخصصات',
    ['التخصص', 'الطلاب', 'نشطون', 'مكتملون', 'الإكمال %', 'متوسط الحضور', 'متوسط الساعات', 'متوسط الاختبار', 'الشهادات'],
    (report.by_specialty || []).map((r) => [
      r.label,
      r.students ?? r.applicants_count,
      r.active,
      r.completed ?? r.completion_count,
      r.completion_pct,
      r.attendance_average,
      r.average_hours,
      r.average_assessment ?? r.post_assessment_average,
      r.certificates,
    ])
  );

  addTableSheet(
    wb,
    '14_المدربون_والمشرفون',
    ['المشرف', 'الطلاب', 'الفرص', 'معدل الإكمال %', 'متوسط التقدم %', 'متوسط الحضور %', 'مهام مقيّمة', 'معلّقة', 'متوسط زمن التقييم'],
    (report.instructors?.rows || []).map((r) => [
      r.name,
      r.students_supervised,
      r.opportunities,
      r.completion_rate,
      r.average_progress,
      r.average_attendance,
      r.tasks_graded,
      r.pending_grading,
      r.average_turnaround_hours,
    ])
  );

  addTableSheet(
    wb,
    '15_الحالات_المعلقة',
    ['الطالب', 'التخصص', 'الفرصة', 'المشكلة', 'الحدة', 'الإجراء'],
    (report.risk || []).map((r) => [r.student_name, r.specialty, r.opportunity, r.issue, r.severity, r.action])
  );
  applyStatusFill(
    wb.getWorksheet('15_الحالات_المعلقة'),
    5,
    2,
    (report.risk || []).length,
    (v) => (String(v).includes('عالية') ? RED : String(v).includes('متوسطة') ? ORANGE : GREEN)
  );

  if (options.includeRawData !== false) {
    addTableSheet(
      wb,
      '16_البيانات_الخام',
    [
      'student_name',
      'student_email',
      'specialty',
      'opportunity_title',
      'organization',
      'instructor',
      'application_status',
      'training_status',
      'attendance_percentage',
      'required_hours',
      'completed_hours',
      'pre_score',
      'post_score',
      'eligibility',
      'certificate',
      'submitted_at',
    ],
    students.map((row) => [
      row.student_name,
      row.student_email,
      row.university_specialty_label,
      row.opportunity_title,
      row.training_organization,
      row.instructor_name,
      row.application_status,
      row.training_status,
      row.attendance_percentage,
      row.required_training_hours,
      row.completed_training_hours,
      row.pre_assessment_score,
      row.post_assessment_score,
      row.eligibility_status,
      row.completion_letter_status,
      dates.formatReportDateTime(row.submitted_at),
    ])
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function exportStudentReportExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';
  wb.created = new Date();
  const exec = report.executive_summary || {};
  const student = report.student || {};
  const opp = report.opportunity || {};
  const hours = report.training_hours || {};
  const att = report.attendance_summary || {};
  const letter = report.completion_letter || {};
  const meta = report.meta || {};

  addKeyValueSheet(wb, '01_ملخص_الطالب', report.report_title, [
    ['الاسم', student.full_name],
    ['البريد', student.email],
    ['الجامعة', student.university?.name],
    ['التخصص', student.university_specialty_label],
    ['مرجع التقرير', meta.reference],
    ['التقدم %', exec.overall_progress],
    ['الحضور %', exec.attendance_percentage],
    ['ساعات منجزة', exec.completed_hours],
    ['ساعات مطلوبة', exec.required_hours],
    ['إنجاز المهام', exec.tasks_required ? exec.task_completion : metrics.NOT_REQUIRED],
    ['تقدم المهمات', exec.task_progress?.display || metrics.NOT_REQUIRED],
    ['نتيجة الاختبار', exec.assessment_result],
    ['حالة التدريب', exec.training_status_label],
    ['الشهادة', exec.certificate_status_label],
  ]);

  addKeyValueSheet(wb, '02_معلومات_التدريب', 'معلومات التدريب', [
    ['الفرصة', opp.title],
    ['جهة التدريب', opp.training_organization || opp.organization_name],
    ['المشرف', opp.assigned_instructor?.full_name],
    ['البداية', dates.formatReportDate(opp.start_date)],
    ['النهاية', dates.formatReportDate(opp.end_date)],
    ['حالة الطلب', labels.labelOf(labels.APPLICATION_STATUS_AR, report.application?.status)],
    ['حالة التدريب', labels.labelOf(labels.TRAINING_STATUS_AR, report.application?.training_status)],
    ['تقدم المهمات', report.application?.task_progress?.display || exec.task_progress?.display || ''],
  ]);

  addTableSheet(
    wb,
    '03_الحضور',
    ['التاريخ', 'الجلسة', 'البداية', 'النهاية', 'المدة', 'الحالة', 'الطريقة', 'ملاحظات'],
    (report.sessions || []).map((s) => [
      dates.formatReportDate(s.session_date),
      s.title,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      s.attendance_status_label || s.attendance?.status,
      s.attendance_method_label || s.attendance?.method,
      s.attendance?.note,
    ])
  );

  addKeyValueSheet(wb, '04_الساعات', 'الساعات', [
    ['مطلوبة', hours.required_training_hours],
    ['مجدولة', hours.scheduled_training_hours],
    ['منجزة', hours.completed_training_hours],
    ['متبقية', hours.remaining_training_hours],
    ['نسبة الاستيفاء %', hours.hours_requirement_percentage || hours.hours_completion_percentage],
    ['الحالة', hoursMod.hoursStatusLabelAr(hours.hours_completion_status)],
    ['حاضر', att.present],
    ['غائب', att.absent],
    ['متأخر', att.late],
    ['معذور', att.excused],
    ['غير مؤكد', att.unconfirmed],
  ]);

  if (report.tasks_required === false && !(report.submissions || []).length) {
    addKeyValueSheet(wb, '05_المهمات', 'المهمات', [['الحالة', metrics.NOT_REQUIRED]]);
  } else {
    addTableSheet(
      wb,
      '05_المهمات',
      ['المهمة', 'الاستحقاق', 'التسليم', 'متأخر', 'الحالة', 'الدرجة', 'الحد الأعلى', 'ملاحظات المدرب'],
      (report.submissions || []).map((s) => [
        s.task_title,
        dates.formatReportDate(s.due_date),
        dates.formatReportDateTime(s.submitted_at),
        s.is_late ? 'نعم' : 'لا',
        s.review_status_label || s.review_status,
        s.manual_score,
        s.max_score,
        s.instructor_feedback,
      ])
    );
  }

  addKeyValueSheet(wb, '06_الاختبارات', 'الاختبارات', [
    ['قبلي', report.pre_assessment?.score],
    ['بعدي', report.post_assessment?.score],
    ['الفرق بالنقاط المئوية', report.learning_improvement?.difference_pp],
    ['تحسن نسبي %', report.learning_improvement?.relative_improvement],
    ['ملاحظة', report.learning_improvement?.observation],
    ['تحفظ', report.learning_improvement?.caveat],
  ]);

  addTableSheet(
    wb,
    '07_التقدم',
    ['المتطلب', 'الحالة'],
    (report.requirements || []).map((r) => [r.label, r.label_ar])
  );

  addKeyValueSheet(wb, '08_الإكمال', 'الإكمال', [
    ['الحالة النهائية', report.completion_decision?.final_status_label],
    ['الأهلية', labels.labelOf(labels.ELIGIBILITY_AR, report.completion_decision?.eligibility)],
    ['تاريخ الإكمال', dates.formatReportDate(report.completion_decision?.completion_date)],
    ['النواقص', (report.completion_decision?.missing_requirements || []).join('، ')],
  ]);

  addKeyValueSheet(wb, '09_الشهادة', 'الشهادة', [
    ['الحالة', letter.status_label],
    ['صادرة', letter.issued ? 'نعم' : 'لا'],
    ['رقم الكتاب', letter.letter_no],
    ['تاريخ الإصدار', dates.formatReportDate(letter.issued_at)],
    ['مرجع التحقق', letter.verification_code],
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  exportUniversityReportExcel,
  exportStudentReportExcel,
};
