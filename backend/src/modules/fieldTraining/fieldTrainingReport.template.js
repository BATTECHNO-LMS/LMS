'use strict';

const metrics = require('./fieldTrainingReport.metrics');
const labels = require('./fieldTrainingReport.labels');
const dates = require('./fieldTrainingReport.dates');
const hoursMod = require('./fieldTraining.hours');

function esc(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value, { missing = metrics.NA } = {}) {
  if (value == null || value === '') return esc(missing);
  return esc(value);
}

function fmtDate(value) {
  return dates.formatReportDate(value) || metrics.NA;
}

function fmtDateTime(value) {
  return dates.formatReportDateTime(value) || metrics.NA;
}

function fmtPct(value) {
  return metrics.displayMetric(value, { kind: 'percent' });
}

const BASE_STYLES = `
  :root {
    --color-primary: #132d4a;
    --color-action: #1e5a8a;
    --color-accent: #c9a227;
    --color-cream: #f7f1e7;
    --color-text: #243241;
    --color-border: #d7dde5;
    --color-success: #2f6b4f;
    --color-warning: #b76e1f;
    --color-danger: #a33b3b;
    --radius: 12px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Tahoma, 'Noto Naskh Arabic', 'DejaVu Sans', Arial, sans-serif;
    direction: rtl;
    color: var(--color-text);
    background: #fff;
    font-size: 12px;
    line-height: 1.65;
  }
  h1, h2, h3 { color: var(--color-primary); }
  .cover {
    min-height: 980px;
    background: linear-gradient(160deg, #0e2136 0%, #132d4a 45%, #1e5a8a 100%);
    color: #fff;
    border-radius: 18px;
    padding: 40px 36px;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  .cover__ornament {
    position: absolute; inset: auto -40px -40px auto; width: 220px; height: 220px;
    border: 18px solid rgba(201,162,39,.25); border-radius: 50%;
  }
  .cover__brands { display:flex; justify-content: space-between; align-items: center; gap: 24px; }
  .logo { height: 64px; width: auto; object-fit: contain; background: rgba(255,255,255,.92); padding: 8px 12px; border-radius: 10px; }
  .logo-fallback { background: rgba(255,255,255,.92); color: var(--color-primary); padding: 12px 16px; border-radius: 10px; font-weight: 700; text-align:center; max-width: 220px; }
  .cover__title { text-align:center; font-size: 26px; margin: 56px 0 10px; font-weight: 800; }
  .cover__sub { text-align:center; font-size: 18px; color: #f3ead4; margin: 0 0 28px; }
  .cover__meta { max-width: 520px; margin: 0 auto; background: rgba(255,255,255,.08); padding: 18px 22px; border-radius: 14px; }
  .cover__meta p { margin: 6px 0; }
  .cover__footer { display:flex; justify-content: space-between; margin-top: 48px; font-size: 11px; opacity: .85; }
  .confidential { letter-spacing: .04em; }
  .page-header { display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin: 0 0 16px; }
  .page-header img { height: 28px; width: auto; object-fit: contain; }
  .page-header__logos { display:flex; align-items:center; gap: 8px; }
  .page-header__text { text-align: left; font-size: 11px; color: #5c6675; }
  .section { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 14px; page-break-inside: avoid; }
  .section h2 { margin: 0 0 12px; font-size: 15px; border-bottom: 2px solid #d4af37; padding-bottom: 4px; }
  .kpi-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
  .kpi { background: var(--color-cream); border-radius: 10px; padding: 10px; border: 1px solid var(--color-border); page-break-inside: avoid; }
  .kpi__label { font-size: 10px; color: #5c6675; }
  .kpi__value { font-size: 14px; font-weight: 700; color: var(--color-primary); margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 11px; }
  thead { display: table-header-group; }
  th, td { border: 1px solid var(--color-border); padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: var(--color-primary); color: #fff; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr { page-break-inside: avoid; }
  .muted { color: #5c6675; font-size: 11px; }
  .callout { background: #e7edf4; border-right: 4px solid var(--color-action); padding: 10px 12px; border-radius: 8px; margin: 8px 0; }
  .callout--warn { border-right-color: var(--color-warning); background: #f8eedf; }
  .toc { padding-inline-start: 1.2rem; }
  .toc a { color: var(--color-action); text-decoration: none; }
  .bars { display:flex; flex-direction: column; gap: 8px; margin: 10px 0; }
  .bar { display:grid; grid-template-columns: 110px 1fr 54px; gap: 8px; align-items:center; }
  .bar__track { height: 10px; background: #e7edf4; border-radius: 999px; overflow:hidden; }
  .bar__fill { height: 100%; background: linear-gradient(90deg, var(--color-action), var(--color-accent)); }
  .kv { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; margin: 8px 0; }
  .kv div:nth-child(odd) { font-weight: 600; color: #3d4a5c; }
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { display:flex; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding: 6px 0; }
  .badge { display:inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2f7; }
  .badge--ok { background: #e7f4ec; color: var(--color-success); }
  .badge--warn { background: #f8eedf; color: var(--color-warning); }
  .badge--bad { background: #f8e7e7; color: var(--color-danger); }
  .wide-table { font-size: 10px; }
  @page { size: A4; margin: 14mm 12mm 18mm; }
  @media print {
    .cover { border-radius: 0; min-height: 100vh; }
    .section { box-shadow: none; }
  }
`;

function logoHtml(dataUri, alt, fallbackText) {
  if (dataUri) return `<img class="logo" src="${dataUri}" alt="${esc(alt)}" />`;
  return `<div class="logo-fallback">${esc(fallbackText)}</div>`;
}

function universityFallbackName(university) {
  const ar = university?.name || '';
  const en = university?.name_en || '';
  return [ar, en].filter(Boolean).join(' / ') || 'الجامعة';
}

function kpiCard(label, value) {
  return `<div class="kpi"><div class="kpi__label">${esc(label)}</div><div class="kpi__value">${cell(value)}</div></div>`;
}

function section(title, body, id) {
  return `<section class="section" id="${esc(id || '')}"><h2>${esc(title)}</h2>${body}</section>`;
}

function table(headers, rows, { empty = 'لا توجد بيانات ضمن نطاق التقرير.', wide = false } = {}) {
  if (!rows?.length) return `<p class="muted">${esc(empty)}</p>`;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="${wide ? 'wide-table' : ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function bars(items, { max = 100 } = {}) {
  if (!items?.length) return '';
  const peak = Math.max(max, ...items.map((i) => Number(i.value) || 0), 1);
  return `<div class="bars">${items
    .map((item) => {
      const v = Number(item.value);
      const width = Number.isFinite(v) ? Math.max(0, Math.min(100, (v / peak) * 100)) : 0;
      return `<div class="bar"><span class="bar__label">${esc(item.label)}</span><div class="bar__track"><div class="bar__fill" style="width:${width}%"></div></div><span class="bar__value">${cell(item.display ?? item.value)}</span></div>`;
    })
    .join('')}</div>`;
}

function kv(pairs) {
  const rows = pairs
    .map(([label, value]) => `<div>${esc(label)}</div><div>${cell(value)}</div>`)
    .join('');
  return `<div class="kv">${rows}</div>`;
}

function buildCover({ title, university, meta, assets }) {
  const uniLogo = logoHtml(
    assets.universityLogoDataUri,
    university?.name || 'الجامعة',
    universityFallbackName(university)
  );
  const batLogo = logoHtml(assets.battechnoLogoDataUri, 'BATTECHNO LMS', 'BATTECHNO LMS');
  return `<section class="cover">
    <div class="cover__brands">
      <div>${batLogo}</div>
      <div>${uniLogo}</div>
    </div>
    <div class="cover__ornament"></div>
    <h1 class="cover__title">${esc(title)}</h1>
    <p class="cover__sub">${esc(university?.name || '')}${university?.name_en ? `<br/>${esc(university.name_en)}` : ''}</p>
    <div class="cover__meta">
      <p><strong>الفترة:</strong> ${esc(meta.period || metrics.NA)}</p>
      <p><strong>تاريخ الإنشاء:</strong> ${esc(meta.generatedAt || metrics.NA)}</p>
      <p><strong>أنشئ بواسطة:</strong> ${esc(meta.generatedBy || metrics.NA)}</p>
      <p><strong>مرجع التقرير:</strong> ${esc(meta.reference || metrics.NA)}</p>
      <p><strong>الإصدار:</strong> ${esc(meta.version || '1')}</p>
    </div>
    <div class="cover__footer">
      <span>BATTECHNO LMS · شركة الرجل الوطواط للتكنولوجيا</span>
      <span class="confidential">للاستخدام الإداري</span>
    </div>
  </section>`;
}

function pageHeader(university, assets, reportType) {
  const uni = assets.universityLogoDataUri
    ? `<img src="${assets.universityLogoDataUri}" alt="" />`
    : `<span>${esc(university?.name || '')}</span>`;
  const bat = assets.battechnoLogoDataUri
    ? `<img src="${assets.battechnoLogoDataUri}" alt="BATTECHNO" />`
    : '<span>BATTECHNO</span>';
  return `<div class="page-header">
    <div class="page-header__logos">${bat}${uni}</div>
    <div class="page-header__text"><strong>${esc(reportType)}</strong></div>
  </div>`;
}

function filtersBlock(filters) {
  if (!filters) return '';
  const entries = Object.entries(filters).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return '';
  return `<p class="muted">عوامل التصفية: ${entries.map(([k, v]) => `${esc(k)} = ${esc(v)}`).join(' · ')}</p>`;
}

function wrapHtml(title, body) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${BASE_STYLES}</style></head><body>${body}</body></html>`;
}

function renderUniversityReportHtml(report, assets = {}) {
  const university = report.university || {};
  const summary = report.summary || {};
  const meta = report.meta || {};
  const toc = [
    ['exec', 'الملخص التنفيذي'],
    ['uni', 'معلومات الجامعة'],
    ['funnel', 'تحليل الالتحاق'],
    ['opps', 'الفرص التدريبية'],
    ['orgs', 'جهات التدريب'],
    ['attendance', 'الحضور'],
    ['hours', 'الساعات التدريبية'],
    ['tasks', 'المهمات'],
    ['assessments', 'الاختبارات'],
    ['progress', 'التقدم'],
    ['completion', 'الإكمال'],
    ['certs', 'الشهادات'],
    ['instructors', 'المدربون والمشرفون'],
    ['specs', 'التخصصات'],
    ['risk', 'حالات تحتاج متابعة'],
    ['reco', 'التوصيات'],
    ['students', 'جدول الطلاب التفصيلي'],
  ];

  const period =
    report.filters?.from || report.filters?.to
      ? `${fmtDate(report.filters.from)} — ${fmtDate(report.filters.to)}`
      : 'كامل السجلات المتاحة';

  const warnings = (report.data_quality_warnings || [])
    .map((w) => `<div class="callout callout--warn">${esc(w)}</div>`)
    .join('');

  const cover = buildCover({
    title: report.report_title || 'التقرير الشامل للتدريب الميداني للجامعة',
    university,
    meta: {
      period,
      generatedAt: meta.generated_at_label || fmtDateTime(meta.generated_at),
      generatedBy: meta.generated_by_name,
      reference: meta.reference,
      version: meta.version || 1,
    },
    assets,
  });

  const exec = section(
    'الملخص التنفيذي',
    `${warnings}
    <div class="kpi-grid">
      ${kpiCard('إجمالي الطلاب', summary.total_applicants)}
      ${kpiCard('قيد التدريب', summary.in_training_students)}
      ${kpiCard('مكتملون', summary.completed_students)}
      ${kpiCard('غير مكتملين', summary.not_completed_students)}
      ${kpiCard('معدل الإكمال', fmtPct(summary.completion_rate))}
      ${kpiCard('الفرص التدريبية', summary.eligible_opportunities)}
      ${kpiCard('جهات التدريب النشطة', summary.active_training_organizations)}
      ${kpiCard('متوسط الحضور', fmtPct(summary.average_attendance))}
      ${kpiCard('إجمالي الساعات', summary.total_training_hours)}
      ${kpiCard('متوسط ساعات الطالب', summary.average_student_hours)}
      ${kpiCard('متوسط إنجاز المهام', fmtPct(summary.average_task_completion))}
      ${kpiCard('متوسط الاختبار البعدي', summary.average_post_assessment_score)}
      ${kpiCard('كتب الإنهاء الصادرة', summary.completion_letters_issued)}
      ${kpiCard('طلاب دون التقدم المطلوب', summary.students_below_progress)}
      ${kpiCard('حالات تحتاج مراجعة', summary.at_risk_students)}
    </div>`,
    'exec'
  );

  const uni = section(
    'معلومات الجامعة',
    kv([
      ['الاسم بالعربية', university.name],
      ['الاسم بالإنجليزية', university.name_en],
      ['الرمز', university.code],
      ['الاسم المختصر', university.short_name],
      ['التخصصات', (university.specialties || []).map((s) => s.name_ar || s.name_en).join('، ')],
      ['عدد الطلاب المشاركين', university.participating_students],
      ['عدد المشرفين', university.instructors_count],
      ['فترة التقرير', period],
    ]),
    'uni'
  );

  const funnel = section(
    'تحليل الالتحاق',
    `${table(
      ['المرحلة', 'العدد', 'النسبة من الإجمالي', 'التحويل من المرحلة السابقة'],
      (report.funnel || []).map((s) => [s.label, s.count, fmtPct(s.percentage_of_total), fmtPct(s.conversion_from_previous)])
    )}${bars((report.funnel || []).map((s) => ({ label: s.label, value: s.count, display: s.count })), { max: Math.max(...(report.funnel || []).map((s) => s.count), 1) })}`,
    'funnel'
  );

  const opps = report.opportunities || {};
  const oppsSection = section(
    'تحليل الفرص التدريبية',
    `<div class="kpi-grid">
      ${kpiCard('إجمالي الفرص', opps.total)}
      ${kpiCard('منشورة', opps.published)}
      ${kpiCard('مفتوحة', opps.open)}
      ${kpiCard('مغلقة', opps.closed)}
      ${kpiCard('السعة', opps.total_capacity)}
      ${kpiCard('المقاعد المتاحة', opps.available_seats)}
      ${kpiCard('الطلبات', opps.applications_received)}
      ${kpiCard('نسبة الإشغال', fmtPct(opps.utilization_rate))}
    </div>
    ${table(
      ['الفرصة', 'جهة التدريب', 'المجال', 'السعة', 'الطلبات', 'المقبولون', 'النشطون', 'المكتملون', 'الحالة', 'البداية', 'النهاية'],
      (opps.rows || []).map((r) => [
        r.title,
        r.organization_name,
        r.field,
        r.capacity,
        r.applications,
        r.accepted_students,
        r.active_students,
        r.completed_students,
        r.status_label,
        fmtDate(r.start_date),
        fmtDate(r.end_date),
      ]),
      { empty: 'لا توجد فرص تدريبية ضمن نطاق التقرير.', wide: true }
    )}`,
    'opps'
  );

  const orgs = section(
    'جهات التدريب',
    table(
      ['الجهة', 'الطلاب', 'الفرص', 'المجالات', 'نشطون', 'مكتملون', 'معدل الإكمال', 'متوسط الحضور'],
      (report.organizations?.rows || []).map((r) => [
        r.name,
        r.hosted_students,
        r.opportunities,
        (r.domains || []).join('، '),
        r.active_students,
        r.completed_students,
        fmtPct(r.completion_rate),
        fmtPct(r.average_attendance),
      ]),
      { empty: 'لا توجد جهات تدريب مسجّلة ضمن النطاق.' }
    ),
    'orgs'
  );

  const att = report.attendance || {};
  const attSection = section(
    'تحليل الحضور',
    `<div class="kpi-grid">
      ${kpiCard('متوسط الحضور', fmtPct(att.average))}
      ${kpiCard('وسيط الحضور', fmtPct(att.median))}
      ${kpiCard('مستوفون للحد', att.meeting_threshold)}
      ${kpiCard('دون الحد', att.below_threshold)}
      ${kpiCard('حاضر', att.counts?.present)}
      ${kpiCard('غائب', att.counts?.absent)}
      ${kpiCard('متأخر', att.counts?.late)}
      ${kpiCard('معذور', att.counts?.excused)}
      ${kpiCard('غير مؤكد', att.counts?.unconfirmed)}
    </div>
    ${att.by_specialty?.length ? `<h3>الحضور حسب التخصص</h3>${bars(att.by_specialty.map((s) => ({ label: s.label, value: s.average, display: fmtPct(s.average) })))}` : '<p class="muted">لا توجد بيانات حضور كافية للرسوم.</p>'}`,
    'attendance'
  );

  const hours = report.hours || {};
  const hoursSection = section(
    'تحليل الساعات التدريبية',
    `<div class="kpi-grid">
      ${kpiCard('ساعات منجزة', hours.total_attended_hours)}
      ${kpiCard('ساعات مطلوبة', hours.total_required_hours)}
      ${kpiCard('ساعات مجدولة', hours.total_scheduled_hours)}
      ${kpiCard('المتوسط', hours.average_hours)}
      ${kpiCard('الوسيط', hours.median_hours)}
      ${kpiCard('الحد الأدنى', hours.min_hours)}
      ${kpiCard('الحد الأعلى', hours.max_hours)}
      ${kpiCard('مستوفون', hours.meeting_required)}
      ${kpiCard('دون المطلوب', hours.below_required)}
    </div>`,
    'hours'
  );

  const tasksA = report.tasks || {};
  const tasksSection = section(
    'تحليل المهمات',
    tasksA.total_tasks
      ? `<div class="kpi-grid">
          ${kpiCard('إجمالي المهام', tasksA.total_tasks)}
          ${kpiCard('التسليمات', tasksA.total_submissions)}
          ${kpiCard('في الوقت', tasksA.on_time)}
          ${kpiCard('متأخر', tasksA.late)}
          ${kpiCard('بانتظار التقييم', tasksA.pending_grading)}
          ${kpiCard('مجتازة', tasksA.passed)}
          ${kpiCard('تحتاج تعديلاً', tasksA.revision_required)}
          ${kpiCard('تسليمات ناقصة', tasksA.missing_submissions)}
        </div>`
      : '<p class="muted">غير مطلوب — لا توجد مهام ضمن نطاق التقرير.</p>',
    'tasks'
  );

  const assessments = report.assessments || {};
  const cmp = assessments.comparison || {};
  const assessSection = section(
    'تحليل الاختبارات',
    assessments.students_attempted_pre || assessments.students_attempted_post
      ? `<div class="kpi-grid">
          ${kpiCard('متوسط القبلي', assessments.average_pre)}
          ${kpiCard('متوسط البعدي', assessments.average_post)}
          ${kpiCard('وسيط البعدي', assessments.median_post)}
          ${kpiCard('معدل المحاولة البعدي', fmtPct(assessments.attempt_rate_post))}
        </div>
        <p class="muted">${esc(cmp.observation || '')}</p>
        <p class="muted">${esc(cmp.caveat || '')}</p>
        ${table(
          ['قبلي', 'بعدي', 'الفرق بالنقاط المئوية', 'تحسنوا', 'ثابتون', 'انخفضوا'],
          [[cmp.average_pre, cmp.average_post, cmp.average_pp, cmp.improved, cmp.unchanged, cmp.decreased]]
        )}`
      : '<p class="muted">لا توجد بيانات اختبارات ضمن نطاق التقرير.</p>',
    'assessments'
  );

  const prog = report.progress || {};
  const progSection = section(
    'تحليل التقدم',
    `${table(
      ['الفئة', 'العدد', 'النسبة'],
      (prog.distribution?.buckets || []).map((b) => [b.label, b.count, fmtPct(b.percentage)])
    )}
    <div class="kpi-grid">
      ${kpiCard('متوسط التقدم', fmtPct(prog.average))}
      ${kpiCard('الوسيط', fmtPct(prog.median))}
      ${kpiCard('مكتملون', prog.completed)}
      ${kpiCard('قريبون من الإكمال', prog.near_completion)}
      ${kpiCard('معرّضون', prog.at_risk)}
    </div>`,
    'progress'
  );

  const completion = report.completion || {};
  const completionSection = section(
    'تحليل الإكمال',
    `<div class="kpi-grid">
      ${kpiCard('مؤهلون', completion.eligible)}
      ${kpiCard('مكتملون', completion.completed)}
      ${kpiCard('غير مكتملين', completion.not_completed)}
      ${kpiCard('قيد الإنجاز', completion.in_progress)}
      ${kpiCard('منسحبون', completion.withdrawn)}
      ${kpiCard('معدل الإكمال', fmtPct(completion.completion_rate))}
    </div>
    ${table(
      ['سبب عدم الإكمال', 'العدد'],
      (completion.reasons || []).map((r) => [r.label, r.count]),
      { empty: 'لا توجد أسباب مخزّنة لعدم الإكمال ضمن النطاق.' }
    )}`,
    'completion'
  );

  const certs = report.certificates || {};
  const certsSection = section(
    'الشهادات / كتب الإنهاء',
    `<div class="kpi-grid">
      ${kpiCard('مؤهلون', certs.eligible)}
      ${kpiCard('صادرة', certs.issued)}
      ${kpiCard('بانتظار الإصدار', certs.pending)}
      ${kpiCard('غير مستوفين', certs.not_eligible)}
      ${kpiCard('معدل الإصدار', fmtPct(certs.issue_rate))}
    </div>
    ${table(
      ['رقم الكتاب', 'تاريخ الإصدار', 'الحالة'],
      (certs.rows || []).map((r) => [r.letter_no, fmtDate(r.issued_at), labels.labelOf(labels.CERTIFICATE_AR, r.status)]),
      { empty: 'لم تصدر كتب إنهاء ضمن نطاق التقرير.' }
    )}`,
    'certs'
  );

  const instructorsSection = section(
    'تحليل المدربين والمشرفين',
    table(
      ['المشرف', 'الطلاب', 'الفرص', 'معدل الإكمال', 'متوسط التقدم', 'متوسط الحضور', 'مهام مقيّمة', 'معلّقة', 'متوسط زمن التقييم (ساعة)'],
      (report.instructors?.rows || []).map((r) => [
        r.name,
        r.students_supervised,
        r.opportunities,
        fmtPct(r.completion_rate),
        fmtPct(r.average_progress),
        fmtPct(r.average_attendance),
        r.tasks_graded,
        r.pending_grading,
        r.average_turnaround_hours,
      ]),
      { empty: 'لا توجد بيانات مشرفين ضمن النطاق.', wide: true }
    ),
    'instructors'
  );

  const specs = section(
    'تحليل التخصصات',
    table(
      ['التخصص', 'الطلاب', 'نشطون', 'مكتملون', 'الإكمال %', 'متوسط الحضور', 'متوسط الساعات', 'متوسط الاختبار', 'الشهادات'],
      (report.by_specialty || []).map((r) => [
        r.label,
        r.students ?? r.applicants_count,
        r.active,
        r.completed ?? r.completion_count,
        fmtPct(r.completion_pct),
        r.attendance_average,
        r.average_hours,
        r.average_assessment ?? r.post_assessment_average,
        r.certificates,
      ])
    ),
    'specs'
  );

  const risk = section(
    'حالات تحتاج متابعة',
    table(
      ['الطالب', 'التخصص', 'الفرصة', 'المشكلة', 'الحدة', 'الإجراء المطلوب'],
      (report.risk || []).map((r) => [r.student_name, r.specialty, r.opportunity, r.issue, r.severity, r.action]),
      { empty: 'لا توجد حالات قواعدية تحتاج متابعة ضمن النطاق.' }
    ),
    'risk'
  );

  const reco = section(
    'التوصيات',
    table(
      ['الملاحظة', 'الدليل', 'الأولوية', 'الإجراء المقترح'],
      (report.recommendations || []).map((r) => [r.finding, r.evidence, r.priority, r.action]),
      { empty: 'لا توجد توصيات مستندة إلى بيانات كافية في هذا النطاق.' }
    ),
    'reco'
  );

  const studentsTable = section(
    'جدول الطلاب التفصيلي',
    table(
      [
        'الطالب',
        'البريد',
        'التخصص',
        'الفرصة',
        'جهة التدريب',
        'المشرف',
        'الحضور %',
        'ساعات مطلوبة',
        'ساعات منجزة',
        'المهام',
        'البعدي',
        'التقدم %',
        'الحالة',
        'الشهادة',
      ],
      (report.students || []).map((r) => [
        r.student_name,
        r.student_email,
        r.university_specialty_label,
        r.opportunity_title,
        r.training_organization,
        r.instructor_name,
        r.attendance_percentage,
        r.required_training_hours,
        r.completed_training_hours,
        r.task_completion != null ? fmtPct(r.task_completion) : metrics.NOT_REQUIRED,
        r.post_assessment_score,
        r.progress_percentage,
        r.training_status_label || r.training_status,
        r.completion_letter_status_label || r.completion_letter_status,
      ]),
      { wide: true }
    ),
    'students'
  );

  const tocHtml = section(
    'جدول المحتويات',
    `<ol class="toc">${toc.map(([id, title], i) => `<li><a href="#${id}">${i + 1}. ${esc(title)}</a></li>`).join('')}</ol>`,
    'toc'
  );

  const body = `
    ${cover}
    ${pageHeader(university, assets, report.report_title || 'تقرير التدريب الميداني')}
    ${filtersBlock(report.filters)}
    ${tocHtml}
    ${exec}${uni}${funnel}${oppsSection}${orgs}${attSection}${hoursSection}${tasksSection}${assessSection}${progSection}${completionSection}${certsSection}${instructorsSection}${specs}${risk}${reco}${studentsTable}
  `;
  return wrapHtml(report.report_title || 'تقرير الجامعة', body);
}

function renderStudentReportHtml(report, assets = {}) {
  const student = report.student || {};
  const university = student.university || {};
  const opp = report.opportunity || {};
  const app = report.application || {};
  const exec = report.executive_summary || {};
  const att = report.attendance_summary || {};
  const hours = report.training_hours || {};
  const letter = report.completion_letter || {};
  const meta = report.meta || {};

  const cover = buildCover({
    title: report.report_title || 'التقرير الفردي للتدريب الميداني للطالب',
    university,
    meta: {
      period: `${fmtDate(opp.start_date)} — ${fmtDate(opp.end_date)}`,
      generatedAt: meta.generated_at_label || fmtDateTime(meta.generated_at),
      generatedBy: meta.generated_by_name,
      reference: meta.reference,
      version: meta.version || 1,
    },
    assets,
  });

  const identity = section(
    'هوية الطالب والتدريب',
    kv([
      ['الاسم', student.full_name],
      ['البريد', student.email],
      ['الجامعة', university.name],
      ['التخصص', student.university_specialty_label],
      ['الفرصة', opp.title],
      ['جهة التدريب', opp.training_organization || opp.organization_name],
      ['المشرف', opp.assigned_instructor?.full_name],
      ['فترة التدريب', `${fmtDate(opp.start_date)} — ${fmtDate(opp.end_date)}`],
      ['حالة الطلب', labels.labelOf(labels.APPLICATION_STATUS_AR, app.status)],
      ['حالة التدريب', labels.labelOf(labels.TRAINING_STATUS_AR, app.training_status)],
    ]),
    'identity'
  );

  const execSection = section(
    'الملخص التنفيذي',
    `<div class="kpi-grid">
      ${kpiCard('التقدم الإجمالي', fmtPct(exec.overall_progress))}
      ${kpiCard('الحضور', fmtPct(exec.attendance_percentage))}
      ${kpiCard('الساعات المنجزة', exec.completed_hours)}
      ${kpiCard('الساعات المطلوبة', exec.required_hours)}
      ${kpiCard('إنجاز المهام', exec.tasks_required ? fmtPct(exec.task_completion) : metrics.NOT_REQUIRED)}
      ${kpiCard('نتيجة الاختبار', exec.assessment_result)}
      ${kpiCard('حالة التدريب', exec.training_status_label)}
      ${kpiCard('الشهادة', exec.certificate_status_label)}
    </div>`,
    'exec'
  );

  const attendanceSection = section(
    'تفاصيل الحضور',
    `<div class="kpi-grid">
      ${kpiCard('الحضور المطلوب', fmtPct(att.required_attendance_percentage))}
      ${kpiCard('الحضور الفعلي', fmtPct(att.attendance_percentage))}
      ${kpiCard('حاضر', att.present)}
      ${kpiCard('غائب', att.absent)}
      ${kpiCard('متأخر', att.late)}
      ${kpiCard('معذور', att.excused)}
      ${kpiCard('غير مؤكد', att.unconfirmed)}
    </div>
    ${table(
      ['التاريخ', 'الجلسة', 'البداية', 'النهاية', 'المدة (دقيقة)', 'الحالة', 'طريقة التسجيل', 'ملاحظات'],
      (report.sessions || []).map((s) => [
        fmtDate(s.session_date),
        s.title,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.attendance_status_label || s.attendance?.status,
        s.attendance_method_label || s.attendance?.method,
        s.attendance?.note,
      ]),
      { empty: 'لا توجد جلسات مسجّلة.' }
    )}`,
    'attendance'
  );

  const hoursSection = section(
    'الساعات التدريبية',
    kv([
      ['المطلوبة', hours.required_training_hours],
      ['المجدولة', hours.scheduled_training_hours],
      ['المنجزة', hours.completed_training_hours],
      ['المتبقي', hours.remaining_training_hours],
      ['نسبة الاستيفاء', fmtPct(hours.hours_requirement_percentage || hours.hours_completion_percentage)],
      ['الحالة', hoursMod.hoursStatusLabelAr(hours.hours_completion_status)],
    ]),
    'hours'
  );

  const tasksSection = section(
    'المهام',
    report.tasks_required === false || (!(report.tasks || []).length && !(report.submissions || []).length)
      ? `<p class="muted">${metrics.NOT_REQUIRED}</p>`
      : table(
          ['المهمة', 'مطلوبة', 'الاستحقاق', 'التسليم', 'التوقيت', 'الحالة', 'الدرجة', 'الحد الأعلى', 'ملاحظات المدرب'],
          (report.submissions || []).map((s) => [
            s.task_title,
            s.is_final_task ? 'نعم' : 'اختيارية/عامة',
            fmtDate(s.due_date),
            fmtDateTime(s.submitted_at),
            s.is_late ? 'متأخر' : s.submitted_at ? 'في الوقت' : metrics.NOT_RECORDED,
            s.review_status_label || s.review_status,
            s.manual_score,
            s.max_score,
            s.instructor_feedback,
          ])
        ),
    'tasks'
  );

  const learning = report.learning_improvement || {};
  const assessSection = section(
    'الاختبارات',
    `${table(
      ['الاختبار', 'النوع', 'التاريخ', 'المحاولة', 'الدرجة', 'الحد الأعلى', 'النسبة', 'النتيجة'],
      [
        [
          report.pre_assessment?.name,
          'قبلي',
          fmtDateTime(report.pre_assessment?.submitted_at),
          report.pre_assessment?.attempt_number,
          report.pre_assessment?.score,
          report.pre_assessment?.max_score,
          fmtPct(report.pre_assessment?.percentage),
          report.pre_assessment?.score == null ? metrics.NOT_RECORDED : 'مُسجَّل',
        ],
        [
          report.post_assessment?.name,
          'بعدي',
          fmtDateTime(report.post_assessment?.submitted_at),
          report.post_assessment?.attempt_number,
          report.post_assessment?.score,
          report.post_assessment?.max_score,
          fmtPct(report.post_assessment?.percentage),
          report.post_assessment?.passed == null
            ? report.post_assessment?.score == null
              ? metrics.NOT_RECORDED
              : metrics.PENDING_EVAL
            : report.post_assessment.passed
              ? 'ناجح'
              : 'غير ناجح',
        ],
      ]
    )}
    ${
      learning.difference_pp != null
        ? `<div class="callout"><p>${esc(learning.observation)}</p><p>قبلي: ${fmtPct(learning.pre_pct)} · بعدي: ${fmtPct(learning.post_pct)} · الفرق: ${metrics.displayMetric(learning.difference_pp, { kind: 'pp' })}</p><p class="muted">${esc(learning.caveat)}</p></div>`
        : '<p class="muted">لا تتوفر نتائج قبلية وبعدية مكتملة للمقارنة.</p>'
    }`,
    'assessments'
  );

  const reqSection = section(
    'متطلبات التقدم',
    `<ul class="checklist">${(report.requirements || [])
      .map(
        (r) =>
          `<li><span>${esc(r.label)}</span><span class="badge ${
            r.state === 'complete' ? 'badge--ok' : r.state === 'pending' ? 'badge--warn' : r.state === 'incomplete' ? 'badge--bad' : ''
          }">${esc(r.label_ar)}</span></li>`
      )
      .join('')}</ul>`,
    'progress'
  );

  const decision = report.completion_decision || {};
  const completionSection = section(
    'قرار الإكمال',
    kv([
      ['الحالة النهائية', decision.final_status_label],
      ['الأهلية', labels.labelOf(labels.ELIGIBILITY_AR, decision.eligibility)],
      ['تاريخ الإكمال', fmtDate(decision.completion_date)],
      ['المتطلبات الناقصة', (decision.missing_requirements || []).join('، ') || 'لا يوجد'],
    ]),
    'completion'
  );

  const certSection = section(
    'الشهادة / كتاب الإنهاء',
    letter.issued
      ? kv([
          ['الحالة', letter.status_label],
          ['رقم الكتاب', letter.letter_no],
          ['تاريخ الإصدار', fmtDate(letter.issued_at)],
          ['مرجع التحقق', letter.verification_code],
        ])
      : `<p>${esc(letter.status_label || 'لم تصدر الشهادة بعد')}</p>`,
    'certificate'
  );

  const reco = section(
    'الخلاصة',
    `<ul>${(report.recommendations || []).map((r) => `<li>${esc(r.text)}</li>`).join('')}</ul>`,
    'reco'
  );

  const body = `
    ${cover}
    ${pageHeader(university, assets, report.report_title || 'التقرير الفردي')}
    ${identity}${execSection}${attendanceSection}${hoursSection}${tasksSection}${assessSection}${reqSection}${completionSection}${certSection}${reco}
  `;
  return wrapHtml(report.report_title || 'تقرير الطالب', body);
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
        <td>${cell(row.university_name)}</td>
        <td>${cell(row.total_applicants)}</td>
        <td>${cell(row.accepted)}</td>
        <td>${cell(row.completed)}</td>
        <td>${cell(row.average_attendance)}</td>
        <td>${cell(row.average_post_assessment)}</td>
      </tr>`
    )
    .join('');

  const specialtyTable = (report.specialty_comparison ?? [])
    .slice(0, 25)
    .map(
      (row) => `<tr>
        <td>${cell(row.label)}</td>
        <td>${cell(row.university_name)}</td>
        <td>${cell(row.applicants)}</td>
        <td>${cell(row.accepted)}</td>
        <td>${cell(row.attendance_average)}</td>
        <td>${cell(row.completions)}</td>
      </tr>`
    )
    .join('');

  const kvRows = summaryRows
    .map(([label, value]) => `<div>${esc(label)}</div><div>${cell(value)}</div>`)
    .join('');

  return wrapHtml(
    report.report_title || 'تقرير',
    `<h1>${esc(report.report_title)}</h1>
    <div class="muted">تقرير ملخص · ${fmtDateTime(report.generated_at ?? new Date())}</div>
    <section class="section"><h2>الملخص التنفيذي</h2><div class="kv">${kvRows}</div></section>
    <section class="section"><h2>مقارنة الجامعات</h2>
    <table><thead><tr><th>الجامعة</th><th>المتقدمون</th><th>المقبولون</th><th>المكتملون</th><th>الحضور</th><th>التقييم البعدي</th></tr></thead>
    <tbody>${uniTable || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table></section>
    <section class="section"><h2>مقارنة التخصصات</h2>
    <table><thead><tr><th>التخصص</th><th>الجامعة</th><th>المتقدمون</th><th>المقبولون</th><th>متوسط الحضور</th><th>المكتملون</th></tr></thead>
    <tbody>${specialtyTable || '<tr><td colspan="6">لا توجد بيانات</td></tr>'}</tbody></table></section>
    <p class="muted">للبيانات التفصيلية الكاملة استخدم تصدير Excel.</p>`
  );
}

module.exports = {
  renderUniversityReportHtml,
  renderStudentReportHtml,
  renderGlobalReportHtml,
};
