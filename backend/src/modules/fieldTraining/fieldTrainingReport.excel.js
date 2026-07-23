const ExcelJS = require('exceljs');

const NAVY = 'FF1B2A4A';
const WHITE = 'FFFFFFFF';
const ALT_ROW = 'FFF5F7FA';
const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

function setupRtlSheet(ws) {
  ws.views = [{ rightToLeft: true }];
}

function styleHeaderRow(ws, rowNum, colCount) {
  for (let c = 1; c <= colCount; c += 1) {
    const cell = ws.getRow(rowNum).getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
}

function addKeyValueSheet(ws, title, rows) {
  setupRtlSheet(ws);
  ws.addRow([title]);
  ws.getRow(1).font = { ...AR_FONT, bold: true, size: 14 };
  ws.addRow([]);
  rows.forEach(([key, value]) => ws.addRow([key, value ?? '—']));
  ws.columns = [{ width: 32 }, { width: 48 }];
}

async function exportUniversityReportExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';

  const summaryWs = wb.addWorksheet('الملخص');
  addKeyValueSheet(summaryWs, report.report_title, [
    ['الجامعة', report.university?.name],
    ['فرص مؤهلة', report.summary?.eligible_opportunities],
    ['إجمالي المتقدمين', report.summary?.total_applicants],
    ['مقبولون', report.summary?.accepted_students],
    ['مرفوضون', report.summary?.rejected_students],
    ['مستبعدون', report.summary?.expelled_students],
    ['قيد التدريب', report.summary?.in_training_students],
    ['مكتملون', report.summary?.completed_students],
    ['كتب إنهاء', report.summary?.completion_letters_issued],
    ['متوسط الحضور %', report.summary?.average_attendance],
    ['متوسط التقييم القبلي', report.summary?.average_pre_assessment_score],
    ['متوسط التقييم البعدي', report.summary?.average_post_assessment_score],
    ['معدل تسليم المهام %', report.summary?.task_submission_rate],
  ]);

  const specialtyWs = wb.addWorksheet('حسب التخصص');
  setupRtlSheet(specialtyWs);
  const specialtyHeaders = [
    'التخصص',
    'المتقدمون',
    'المقبولون',
    'متوسط الحضور',
    'معدل إكمال المهام',
    'متوسط التقييم البعدي',
    'المكتملون',
  ];
  specialtyWs.addRow(specialtyHeaders);
  styleHeaderRow(specialtyWs, 1, specialtyHeaders.length);
  (report.by_specialty ?? []).forEach((row) => {
    specialtyWs.addRow([
      row.label,
      row.applicants_count,
      row.accepted_count,
      row.attendance_average,
      row.task_completion_rate,
      row.post_assessment_average,
      row.completion_count,
    ]);
  });

  const studentsWs = wb.addWorksheet('الطلاب');
  setupRtlSheet(studentsWs);
  const studentHeaders = [
    'الطالب',
    'التخصص',
    'الفرصة',
    'حالة الطلب',
    'حالة التدريب',
    'الحضور %',
    'الساعات المطلوبة',
    'الساعات المنجزة',
    'الساعات المتبقية',
    'نسبة إكمال الساعات %',
    'حالة إكمال الساعات',
    'التقييم القبلي',
    'التقييم البعدي',
    'المهمة النهائية',
    'الأهلية',
    'كتاب الإنهاء',
  ];
  studentsWs.addRow(studentHeaders);
  styleHeaderRow(studentsWs, 1, studentHeaders.length);
  (report.students ?? []).forEach((row, index) => {
    const excelRow = studentsWs.addRow([
      row.student_name,
      row.university_specialty_label,
      row.opportunity_title,
      row.application_status,
      row.training_status,
      row.attendance_percentage,
      row.required_training_hours,
      row.completed_training_hours,
      row.remaining_training_hours,
      row.hours_completion_percentage,
      row.hours_completion_status_label ?? row.hours_completion_status,
      row.pre_assessment_score,
      row.post_assessment_score,
      row.final_task_status,
      row.eligibility_status,
      row.completion_letter_status,
    ]);
    if (index % 2 === 1) {
      excelRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function exportStudentReportExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';

  const infoWs = wb.addWorksheet('بيانات الطالب');
  addKeyValueSheet(infoWs, report.report_title, [
    ['الاسم', report.student?.full_name],
    ['البريد', report.student?.email],
    ['الهاتف', report.student?.phone],
    ['الجامعة', report.student?.university?.name],
    ['التخصص الجامعي', report.student?.university_specialty_label],
    ['المسار التدريبي', report.student?.canonical_specialty_label],
    ['حالة الحساب', report.student?.account_status],
    ['الفرصة', report.opportunity?.title],
    ['المسار الرئيسي', report.opportunity?.training_track?.name_ar ?? report.opportunity?.training_track?.name_en],
    ['المدرب', report.opportunity?.assigned_instructor?.full_name],
    ['حالة الطلب', report.application?.status],
    ['حالة التدريب', report.application?.training_status],
    ['التقييم القبلي', report.pre_assessment?.score],
    ['التقييم البعدي', report.post_assessment?.score],
    ['نسبة الحضور', report.attendance_summary?.attendance_percentage],
    ['الساعات المطلوبة', report.training_hours?.required_training_hours],
    ['الساعات المنجزة', report.training_hours?.completed_training_hours],
    ['الساعات المتبقية', report.training_hours?.remaining_training_hours],
    ['نسبة إكمال الساعات %', report.training_hours?.hours_completion_percentage],
    [
      'حالة إكمال الساعات',
      require('./fieldTraining.hours').hoursStatusLabelAr(report.training_hours?.hours_completion_status),
    ],
    ['أهلية الإنهاء', report.completion_eligibility?.status],
    ['كتاب الإنهاء', report.completion_letter?.issued ? 'صادر' : 'غير صادر'],
  ]);

  const sessionsWs = wb.addWorksheet('الجلسات');
  setupRtlSheet(sessionsWs);
  const sessionHeaders = ['الجلسة', 'التاريخ', 'الحالة', 'ملاحظات'];
  sessionsWs.addRow(sessionHeaders);
  styleHeaderRow(sessionsWs, 1, sessionHeaders.length);
  (report.sessions ?? []).forEach((session) => {
    sessionsWs.addRow([
      session.title,
      session.session_date,
      session.attendance?.status ?? '—',
      session.attendance?.note ?? '',
    ]);
  });

  const tasksWs = wb.addWorksheet('المهام');
  setupRtlSheet(tasksWs);
  const taskHeaders = [
    'المهمة',
    'موعد التسليم',
    'نهائية',
    'تقييم ذاتي AI',
    'ملف تعليمات',
    'ملف الحل',
    'الحالة',
    'تاريخ التسليم',
    'متأخر',
    'مدخل التقييم الذاتي',
    'برومبت AI',
    'رد AI',
    'ملاحظات الطالب',
    'ملاحظات المدرب',
  ];
  tasksWs.addRow(taskHeaders);
  styleHeaderRow(tasksWs, 1, taskHeaders.length);
  (report.submissions ?? []).forEach((submission) => {
    tasksWs.addRow([
      submission.task_title,
      submission.due_date,
      submission.is_final_task ? 'نعم' : 'لا',
      submission.requires_ai_self_evaluation ? 'نعم' : 'لا',
      submission.instruction_file_name ?? (submission.has_instruction_file ? 'نعم' : 'لا'),
      submission.solution_file_name ?? (submission.has_solution_file ? 'نعم' : 'لا'),
      submission.review_status,
      submission.submitted_at,
      submission.is_late ? 'نعم' : 'لا',
      submission.student_self_evaluation_input,
      submission.ai_prompt_used,
      submission.ai_raw_response || submission.ai_response_inserted_text,
      submission.final_student_notes,
      submission.instructor_feedback,
    ]);
  });

  const timelineWs = wb.addWorksheet('السجل الزمني');
  setupRtlSheet(timelineWs);
  timelineWs.addRow(['التاريخ', 'الحدث']);
  styleHeaderRow(timelineWs, 1, 2);
  (report.timeline ?? []).forEach((event) => {
    timelineWs.addRow([event.at, event.label_ar]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  exportUniversityReportExcel,
  exportStudentReportExcel,
};
