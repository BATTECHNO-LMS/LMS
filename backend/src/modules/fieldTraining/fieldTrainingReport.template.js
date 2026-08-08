function esc(value) {
  if (value == null || value === '') return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return String(value);
  }
}

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: Tajawal, 'IBM Plex Sans Arabic', Arial, sans-serif;
    direction: rtl;
    color: #1b2a4a;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.6;
  }
  h1 { font-size: 20px; margin: 0 0 8px; color: #1b2a4a; }
  h2 { font-size: 15px; margin: 20px 0 8px; color: #1b2a4a; border-bottom: 2px solid #d4af37; padding-bottom: 4px; }
  .meta { color: #5c6675; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #d0d5dd; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #1b2a4a; color: #fff; font-weight: 600; }
  tr:nth-child(even) td { background: #f5f7fa; }
  .kv { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; margin: 8px 0; }
  .kv div:nth-child(odd) { font-weight: 600; color: #3d4a5c; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eef2f7; }
`;

function renderSection(title, pairs) {
  const rows = pairs
    .map(([label, value]) => `<div>${esc(label)}</div><div>${esc(value)}</div>`)
    .join('');
  return `<h2>${esc(title)}</h2><div class="kv">${rows}</div>`;
}

function renderUniversityReportHtml(report) {
  const summary = report.summary ?? {};
  const summaryRows = [
    ['فرص مؤهلة', summary.eligible_opportunities],
    ['إجمالي المتقدمين', summary.total_applicants],
    ['مقبولون', summary.accepted_students],
    ['مرفوضون', summary.rejected_students],
    ['مستبعدون', summary.expelled_students],
    ['قيد التدريب', summary.in_training_students],
    ['مكتملون', summary.completed_students],
    ['كتب إنهاء صادرة', summary.completion_letters_issued],
    ['متوسط الحضور %', summary.average_attendance],
    ['متوسط التقييم القبلي', summary.average_pre_assessment_score],
    ['متوسط التقييم البعدي', summary.average_post_assessment_score],
    ['معدل تسليم المهام %', summary.task_submission_rate],
  ];

  const specialtyTable = (report.by_specialty ?? [])
    .map(
      (row) => `<tr>
        <td>${esc(row.label)}</td>
        <td>${esc(row.applicants_count)}</td>
        <td>${esc(row.accepted_count)}</td>
        <td>${esc(row.attendance_average)}</td>
        <td>${esc(row.task_completion_rate)}</td>
        <td>${esc(row.post_assessment_average)}</td>
        <td>${esc(row.completion_count)}</td>
      </tr>`
    )
    .join('');

  const studentsTable = (report.students ?? [])
    .map(
      (row) => `<tr>
        <td>${esc(row.student_name)}</td>
        <td>${esc(row.university_specialty_label)}</td>
        <td>${esc(row.opportunity_title)}</td>
        <td>${esc(row.application_status)}</td>
        <td>${esc(row.training_status)}</td>
        <td>${esc(row.attendance_percentage)}</td>
        <td>${esc(row.required_training_hours)}</td>
        <td>${esc(row.completed_training_hours)}</td>
        <td>${esc(row.remaining_training_hours)}</td>
        <td>${esc(row.hours_completion_percentage)}</td>
        <td>${esc(row.hours_completion_status_label ?? row.hours_completion_status)}</td>
        <td>${esc(row.pre_assessment_score)}</td>
        <td>${esc(row.post_assessment_score)}</td>
        <td>${esc(row.final_task_status)}</td>
        <td>${esc(row.eligibility_status)}</td>
        <td>${esc(row.completion_letter_status)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head><body>
    <h1>${esc(report.report_title)}</h1>
    <div class="meta">الجامعة: ${esc(report.university?.name)} · ${fmtDate(new Date())}</div>
    ${renderSection('ملخص المؤشرات', summaryRows)}
    <h2>التفصيل حسب التخصص</h2>
    <table>
      <thead><tr>
        <th>التخصص</th><th>المتقدمون</th><th>المقبولون</th><th>متوسط الحضور</th>
        <th>معدل المهام</th><th>متوسط التقييم البعدي</th><th>المكتملون</th>
      </tr></thead>
      <tbody>${specialtyTable || '<tr><td colspan="7">لا توجد بيانات</td></tr>'}</tbody>
    </table>
    <h2>جدول الطلاب</h2>
    <table>
      <thead><tr>
        <th>الطالب</th><th>التخصص</th><th>الفرصة</th><th>حالة الطلب</th><th>حالة التدريب</th>
        <th>الحضور %</th><th>ساعات مطلوبة</th><th>ساعات منجزة</th><th>ساعات متبقية</th>
        <th>إكمال الساعات %</th><th>حالة الساعات</th>
        <th>قبلي</th><th>بعدي</th><th>المهمة النهائية</th><th>الأهلية</th><th>كتاب الإنهاء</th>
      </tr></thead>
      <tbody>${studentsTable || '<tr><td colspan="16">لا توجد بيانات</td></tr>'}</tbody>
    </table>
  </body></html>`;
}

function renderStudentReportHtml(report) {
  const studentSection = renderSection('بيانات الطالب', [
    ['الاسم', report.student?.full_name],
    ['البريد', report.student?.email],
    ['الهاتف', report.student?.phone],
    ['الجامعة', report.student?.university?.name],
    ['التخصص الجامعي', report.student?.university_specialty_label],
    ['المسار المعياري', report.student?.canonical_specialty_label],
    ['حالة الحساب', report.student?.account_status],
  ]);

  const opp = report.opportunity ?? {};
  const opportunitySection = renderSection('بيانات الفرصة', [
    ['عنوان الفرصة', opp.title],
    ['المسار التدريبي', opp.training_track?.name_ar ?? opp.training_track?.name_en],
    ['المدرب', opp.assigned_instructor?.full_name],
    ['تاريخ البداية', opp.start_date],
    ['تاريخ النهاية', opp.end_date],
    ['النمط / الموقع', opp.training_mode ?? opp.location],
    ['الساعات المطلوبة', opp.required_training_hours],
  ]);

  const app = report.application ?? {};
  const applicationSection = renderSection('بيانات الطلب', [
    ['تاريخ التقديم', fmtDate(app.created_at)],
    ['حالة الطلب', app.status],
    ['حالة التدريب', app.training_status],
    ['ملاحظة الإدارة', app.admin_note],
    ['ملاحظة المراجع', app.reviewer_note],
    ['سبب الرفض/الاستبعاد', app.rejection_reason ?? app.expulsion_reason],
  ]);

  const sessionsTable = (report.sessions ?? [])
    .map(
      (session) => `<tr>
        <td>${esc(session.title)}</td>
        <td>${esc(session.session_date)} ${esc(session.start_time ?? '')}</td>
        <td>${esc(session.attendance?.status ?? '—')}</td>
        <td>${esc(session.attendance?.note ?? '')}</td>
      </tr>`
    )
    .join('');

  const att = report.attendance_summary ?? {};
  const hours = report.training_hours ?? {};
  const hoursMod = require('./fieldTraining.hours');
  const attendanceSection = renderSection('ملخص الحضور', [
    ['إجمالي الجلسات', att.total_sessions],
    ['حاضر', att.present],
    ['غائب', att.absent],
    ['متأخر', att.late],
    ['معذور', att.excused],
    ['نسبة الحضور %', att.attendance_percentage],
    ['أهلية الحضور', att.attendance_eligibility == null ? '—' : att.attendance_eligibility ? 'مستوفى' : 'غير مستوفى'],
  ]);
  const hoursSection = renderSection('تقدم الساعات التدريبية', [
    ['الساعات المطلوبة', hours.required_training_hours],
    ['الساعات المنجزة', hours.completed_training_hours],
    ['الساعات المتبقية', hours.remaining_training_hours],
    ['نسبة الإنجاز %', hours.hours_completion_percentage],
    ['حالة إكمال الساعات', hoursMod.hoursStatusLabelAr(hours.hours_completion_status)],
  ]);

  const submissionsTable = (report.submissions ?? [])
    .map(
      (sub) => `<tr>
        <td>${esc(sub.task_title)}</td>
        <td>${esc(sub.due_date)}</td>
        <td>${sub.is_final_task ? 'نعم' : 'لا'}</td>
        <td>${esc(sub.review_status)}</td>
        <td>${fmtDate(sub.submitted_at)}</td>
        <td>${sub.is_late ? 'متأخر' : 'في الوقت'}</td>
        <td>${esc(sub.instructor_feedback)}</td>
      </tr>`
    )
    .join('');

  const timelineRows = (report.timeline ?? [])
    .map((event) => `<tr><td>${fmtDate(event.at)}</td><td>${esc(event.label_ar)}</td></tr>`)
    .join('');

  const letter = report.completion_letter ?? {};
  const letterSection = renderSection('كتاب الإنهاء', [
    ['صادر', letter.issued ? 'نعم' : 'لا'],
    ['رقم الكتاب', letter.letter_no],
    ['تاريخ الإصدار', fmtDate(letter.issued_at)],
    ['رمز التحقق', letter.verification_code],
  ]);

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head><body>
    <h1>${esc(report.report_title)}</h1>
    <div class="meta">${esc(report.student?.full_name)} · ${fmtDate(new Date())}</div>
    ${studentSection}
    ${opportunitySection}
    ${applicationSection}
    ${renderSection('التقييم القبلي', [
      ['الدرجة', report.pre_assessment?.score],
      ['المستوى', report.pre_assessment?.level],
      ['تاريخ الإرسال', fmtDate(report.pre_assessment?.submitted_at)],
    ])}
    ${attendanceSection}
    ${hoursSection}
    <h2>الجلسات والحضور</h2>
    <table><thead><tr><th>الجلسة</th><th>التاريخ</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
    <tbody>${sessionsTable || '<tr><td colspan="4">لا توجد جلسات</td></tr>'}</tbody></table>
    <h2>المهام والتسليمات</h2>
    <table><thead><tr><th>المهمة</th><th>الاستحقاق</th><th>نهائية</th><th>المراجعة</th><th>التسليم</th><th>التوقيت</th><th>ملاحظات المدرب</th></tr></thead>
    <tbody>${submissionsTable || '<tr><td colspan="7">لا توجد تسليمات</td></tr>'}</tbody></table>
    ${renderSection('التقييم البعدي', [
      ['الدرجة', report.post_assessment?.score],
      ['النجاح', report.post_assessment?.passed == null ? '—' : report.post_assessment?.passed ? 'ناجح' : 'راسب'],
      ['تاريخ الإرسال', fmtDate(report.post_assessment?.submitted_at)],
    ])}
    ${renderSection('أهلية الإنهاء', [
      ['الحالة', report.completion_eligibility?.status],
      ['قاعدة الحضور', report.completion_eligibility?.attendance_rule],
      ['قاعدة الساعات', report.completion_eligibility?.hours_rule],
      ['قاعدة المهام', report.completion_eligibility?.task_rule],
      ['قاعدة التقييم البعدي', report.completion_eligibility?.post_assessment_rule],
      ['السبب', typeof report.completion_eligibility?.reason === 'object' ? JSON.stringify(report.completion_eligibility.reason) : report.completion_eligibility?.reason],
    ])}
    ${letterSection}
    <h2>السجل الزمني</h2>
    <table><thead><tr><th>التاريخ</th><th>الحدث</th></tr></thead>
    <tbody>${timelineRows || '<tr><td colspan="2">لا توجد أحداث</td></tr>'}</tbody></table>
  </body></html>`;
}

function renderGlobalReportHtml(report) {
  const s = report.summary ?? {};
  const summaryRows = [
    ['عدد الجامعات', s.universities_count],
    ['عدد الفرص', s.opportunities_count],
    ['عدد الطلبات', s.applications_count],
    ['عدد الطلاب', s.students_count],
    ['المقبولون', s.accepted_count],
    ['كتب الإنهاء', s.completion_letters_count],
    ['المستبعدون', s.expelled_count],
    ['متوسط الحضور %', s.average_attendance],
    ['متوسط التقييم القبلي', s.average_pre_assessment],
    ['متوسط التقييم البعدي', s.average_post_assessment],
  ];

  const uniTable = (report.university_comparison ?? [])
    .slice(0, 25)
    .map(
      (row) => `<tr>
        <td>${esc(row.university_name)}</td>
        <td>${esc(row.total_applicants)}</td>
        <td>${esc(row.accepted)}</td>
        <td>${esc(row.completed)}</td>
        <td>${esc(row.average_attendance)}</td>
        <td>${esc(row.average_post_assessment)}</td>
      </tr>`
    )
    .join('');

  const specialtyTable = (report.specialty_comparison ?? [])
    .slice(0, 25)
    .map(
      (row) => `<tr>
        <td>${esc(row.label)}</td>
        <td>${esc(row.university_name)}</td>
        <td>${esc(row.applicants)}</td>
        <td>${esc(row.accepted)}</td>
        <td>${esc(row.attendance_average)}</td>
        <td>${esc(row.completions)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head><body>
    <h1>${esc(report.report_title)}</h1>
    <div class="meta">تقرير ملخص · ${fmtDate(report.generated_at ?? new Date())}</div>
    ${renderSection('الملخص التنفيذي', summaryRows)}
    <h2>مقارنة الجامعات</h2>
    <table><thead><tr><th>الجامعة</th><th>المتقدمون</th><th>المقبولون</th><th>المكتملون</th><th>الحضور</th><th>التقييم البعدي</th></tr></thead>
    <tbody>${uniTable || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table>
    <h2>مقارنة التخصصات</h2>
    <table><thead><tr><th>التخصص</th><th>الجامعة</th><th>المتقدمون</th><th>المقبولون</th><th>متوسط الحضور</th><th>المكتملون</th></tr></thead>
    <tbody>${specialtyTable || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table>
    <p class="meta">للبيانات التفصيلية الكاملة استخدم تصدير Excel.</p>
  </body></html>`;
}

module.exports = {
  renderUniversityReportHtml,
  renderStudentReportHtml,
  renderGlobalReportHtml,
};
