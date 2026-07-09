const ExcelJS = require('exceljs');

const NAVY = 'FF1B2A4A';
const WHITE = 'FFFFFFFF';
const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

function setupRtlSheet(ws) {
  ws.views = [{ rightToLeft: true }];
}

function styleHeader(ws, rowNum, colCount) {
  for (let c = 1; c <= colCount; c += 1) {
    const cell = ws.getRow(rowNum).getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
}

function addTable(ws, headers, rows) {
  ws.addRow(headers);
  styleHeader(ws, 1, headers.length);
  rows.forEach((row) => ws.addRow(row));
  ws.columns.forEach((col, index) => {
    col.width = Math.min(Math.max((headers[index]?.length ?? 10) + 4, 12), 42);
  });
}

async function exportGlobalReportExcel(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';
  const s = report.summary ?? {};

  const executive = wb.addWorksheet('الملخص التنفيذي');
  setupRtlSheet(executive);
  addTable(executive, ['المؤشر', 'القيمة'], [
    ['عدد الجامعات', s.universities_count],
    ['عدد الفرص', s.opportunities_count],
    ['صفوف الأهلية', s.eligibility_rows_count],
    ['عدد الطلبات', s.applications_count],
    ['عدد الطلاب', s.students_count],
    ['سجلات الحضور', s.attendance_records_count],
    ['تسليمات المهام', s.task_submissions_count],
    ['محاولات التقييم القبلي', s.pre_assessment_attempts],
    ['محاولات التقييم البعدي', s.post_assessment_attempts],
    ['كتب الإنهاء', s.completion_letters_count],
    ['المستبعدون', s.expelled_count],
    ['المقبولون', s.accepted_count],
    ['متوسط الحضور', s.average_attendance],
    ['متوسط التقييم القبلي', s.average_pre_assessment],
    ['متوسط التقييم البعدي', s.average_post_assessment],
  ]);

  const uniWs = wb.addWorksheet('الجامعات');
  setupRtlSheet(uniWs);
  addTable(
    uniWs,
    ['الجامعة', 'فرص مؤهلة', 'متقدمون', 'مقبولون', 'مرفوضون', 'مستبعدون', 'مكتملون', 'كتب إنهاء', 'متوسط الحضور', 'متوسط قبلي', 'متوسط بعدي', 'تسليمات AI'],
    (report.university_comparison ?? []).map((row) => [
      row.university_name,
      row.eligible_opportunities,
      row.total_applicants,
      row.accepted,
      row.rejected,
      row.expelled,
      row.completed,
      row.completion_letters,
      row.average_attendance,
      row.average_pre_assessment,
      row.average_post_assessment,
      row.ai_submissions,
    ])
  );

  const oppWs = wb.addWorksheet('الفرص');
  setupRtlSheet(oppWs);
  addTable(
    oppWs,
    ['العنوان', 'الحالة', 'المسار', 'النمط', 'الموقع', 'البداية', 'النهاية', 'المقاعد'],
    (report.opportunities ?? []).map((row) => [
      row.title,
      row.status,
      row.specialty?.name_ar ?? row.specialty?.name_en,
      row.training_mode,
      row.location,
      row.start_date,
      row.end_date,
      row.seats_limit,
    ])
  );

  const eligWs = wb.addWorksheet('التخصصات المؤهلة');
  setupRtlSheet(eligWs);
  addTable(
    eligWs,
    ['الفرصة', 'الجامعة', 'التخصص الجامعي', 'المسار المعياري', 'حد المقاعد', 'نشط'],
    (report.eligibility ?? []).map((row) => [
      row.opportunity_title,
      row.university_name,
      row.university_specialty_label,
      row.canonical_specialty_label,
      row.seats_limit,
      row.is_active ? 'نعم' : 'لا',
    ])
  );

  const studentsWs = wb.addWorksheet('الطلاب');
  setupRtlSheet(studentsWs);
  addTable(
    studentsWs,
    ['الاسم', 'البريد', 'الهاتف', 'الجامعة', 'التخصص', 'المسار', 'حالة الحساب'],
    (report.students ?? []).map((row) => [
      row.full_name,
      row.email,
      row.phone,
      row.university_name,
      row.university_specialty_label,
      row.canonical_specialty_label,
      row.account_status,
    ])
  );

  const appsWs = wb.addWorksheet('الطلبات');
  setupRtlSheet(appsWs);
  addTable(
    appsWs,
    ['الطالب', 'الجامعة', 'التخصص', 'الفرصة', 'حالة الطلب', 'حالة التدريب', 'الحضور %', 'قبلي', 'بعدي', 'المهمة النهائية', 'الأهلية'],
    (report.applications ?? []).map((row) => [
      row.student_name,
      row.university_name,
      row.university_specialty_label,
      row.opportunity_title,
      row.status,
      row.training_status,
      row.attendance_percentage,
      row.pre_assessment_score,
      row.post_assessment_score,
      row.final_task_status,
      row.completion_eligibility_status,
    ])
  );

  const attWs = wb.addWorksheet('الحضور');
  setupRtlSheet(attWs);
  addTable(
    attWs,
    ['الجلسة', 'التاريخ', 'الفرصة', 'الطلب', 'الطالب', 'الحالة', 'ملاحظة', 'تاريخ التسجيل'],
    (report.attendance ?? []).map((row) => [
      row.session_title,
      row.session_date,
      row.opportunity_id,
      row.application_id,
      row.student_id,
      row.status,
      row.note,
      row.recorded_at,
    ])
  );

  const tasksWs = wb.addWorksheet('المهام والتسليمات');
  setupRtlSheet(tasksWs);
  addTable(
    tasksWs,
    ['المهمة', 'الفرصة', 'نهائية', 'AI', 'الحالة', 'التسليم', 'متأخر', 'ملاحظات الطالب', 'ملاحظات المدرب'],
    (report.submissions ?? []).map((row) => [
      row.task_title,
      row.opportunity_id,
      row.is_final_task ? 'نعم' : 'لا',
      row.requires_ai_self_evaluation ? 'نعم' : 'لا',
      row.review_status,
      row.submitted_at,
      row.is_late ? 'نعم' : 'لا',
      row.final_student_notes,
      row.instructor_feedback,
    ])
  );

  const aiWs = wb.addWorksheet('التقييم الذاتي بالذكاء الاصطناعي');
  setupRtlSheet(aiWs);
  addTable(
    aiWs,
    ['المهمة', 'الطلب', 'الطالب', 'مدخل الطالب', 'النموذج', 'الاستجابة', 'تاريخ التسليم'],
    (report.ai_self_evaluations ?? []).map((row) => [
      row.task_title,
      row.application_id,
      row.student_id,
      row.student_self_evaluation_input,
      row.ai_model_name,
      row.ai_raw_response,
      row.submitted_at,
    ])
  );

  const preWs = wb.addWorksheet('الامتحان القبلي');
  setupRtlSheet(preWs);
  addTable(
    preWs,
    ['التقييم', 'الفرصة', 'الطلب', 'الطالب', 'الدرجة', 'المستوى', 'تاريخ الإرسال'],
    (report.pre_assessments ?? []).map((row) => [
      row.assessment_title,
      row.opportunity_id,
      row.application_id,
      row.student_id,
      row.score,
      row.level,
      row.submitted_at,
    ])
  );

  const postWs = wb.addWorksheet('الامتحان البعدي');
  setupRtlSheet(postWs);
  addTable(
    postWs,
    ['التقييم', 'الفرصة', 'الطلب', 'الطالب', 'الدرجة', 'النجاح', 'تاريخ الإرسال'],
    (report.post_assessments ?? []).map((row) => [
      row.assessment_title,
      row.opportunity_id,
      row.application_id,
      row.student_id,
      row.score,
      row.passed == null ? '' : row.passed ? 'ناجح' : 'راسب',
      row.submitted_at,
    ])
  );

  const eligStatusWs = wb.addWorksheet('الأهلية');
  setupRtlSheet(eligStatusWs);
  addTable(
    eligStatusWs,
    ['الطلب', 'الطالب', 'الفرصة', 'الحالة', 'الحضور %', 'المهمة النهائية', 'التقييم البعدي', 'السبب'],
    (report.eligibility_status ?? []).map((row) => [
      row.application_id,
      row.student_id,
      row.opportunity_id,
      row.completion_eligibility_status,
      row.attendance_percentage,
      row.final_task_status,
      row.post_assessment_score,
      typeof row.eligibility_reason === 'object' ? JSON.stringify(row.eligibility_reason) : row.eligibility_reason,
    ])
  );

  const lettersWs = wb.addWorksheet('كتب الإنهاء');
  setupRtlSheet(lettersWs);
  addTable(
    lettersWs,
    ['رقم الكتاب', 'الطلب', 'الطالب', 'الفرصة', 'تاريخ الإصدار', 'رمز التحقق'],
    (report.completion_letters ?? []).map((row) => [
      row.letter_no,
      row.application_id,
      row.student_id,
      row.opportunity_id,
      row.issued_at,
      row.verification_code,
    ])
  );

  const expWs = wb.addWorksheet('الاستبعادات');
  setupRtlSheet(expWs);
  addTable(
    expWs,
    ['الطالب', 'الفرصة', 'الطلب', 'تاريخ الاستبعاد', 'السبب'],
    (report.expulsions ?? []).map((row) => [
      row.student_name,
      row.opportunity_title,
      row.application_id,
      row.expelled_at,
      row.expulsion_reason,
    ])
  );

  const rawWs = wb.addWorksheet('البيانات الخام');
  setupRtlSheet(rawWs);
  addTable(
    rawWs,
    ['الطلب', 'الطالب', 'الجامعة', 'التخصص', 'الفرصة', 'حالة الطلب', 'حالة التدريب', 'الحضور', 'قبلي', 'بعدي', 'المهمة', 'الأهلية', 'كتاب الإنهاء', 'استبعاد', 'تاريخ التقديم'],
    (report.raw_rows ?? []).map((row) => [
      row.application_id,
      row.student_name,
      row.university_name,
      row.university_specialty,
      row.opportunity_title,
      row.status,
      row.training_status,
      row.attendance_percentage,
      row.pre_assessment_score,
      row.post_assessment_score,
      row.final_task_status,
      row.completion_eligibility_status,
      row.completion_letter_issued_at,
      row.expelled_at,
      row.created_at,
    ])
  );

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { exportGlobalReportExcel };
