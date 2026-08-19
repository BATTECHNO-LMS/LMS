'use strict';

/**
 * Branded RTL HTML template for institutional training official reports.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(value) {
  if (value == null || value === '') return 'غير متوفر';
  if (typeof value === 'number') return String(value);
  return escapeHtml(value);
}

function kpiCard(label, value) {
  return `<div class="kpi"><div class="kpi__label">${escapeHtml(label)}</div><div class="kpi__value">${fmt(value)}</div></div>`;
}

function section(title, body, id) {
  return `<section class="section" id="${escapeHtml(id || '')}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function table(headers, rows) {
  if (!rows?.length) return `<p class="muted">لا توجد بيانات في هذا الجدول.</p>`;
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (row, idx) =>
        `<tr class="${idx % 2 ? 'alt' : ''}">${row.map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`
    )
    .join('');
  return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function barChart(items, { max = 100 } = {}) {
  if (!items?.length) return '';
  return `<div class="bars">${items
    .map((item) => {
      const v = Number(item.value) || 0;
      const width = Math.max(0, Math.min(100, (v / max) * 100));
      return `<div class="bar"><span class="bar__label">${escapeHtml(item.label)}</span><div class="bar__track"><div class="bar__fill" style="width:${width}%"></div></div><span class="bar__value">${fmt(item.value)}</span></div>`;
    })
    .join('')}</div>`;
}

function sectionKirkpatrick(snap) {
  const k = snap.kirkpatrick || {};
  const l1 = k.level1 || {};
  const l2 = k.level2 || snap.learningImpact || {};
  const avgs = snap.evaluation?.averages || {};
  return `
    <h3>${escapeHtml(l1.label || 'المستوى الأول — Reaction')}</h3>
    <p class="muted">${escapeHtml(l1.note || '')}</p>
    ${table(
      ['المحور', 'المتوسط', 'حجم العينة'],
      [
        ['تقييم المدرب', l1.trainer ?? avgs.trainer_score, l1.sampleSize],
        ['تقييم المحتوى', l1.content ?? avgs.content_score, l1.sampleSize],
        ['تقييم الأنشطة', l1.activities ?? avgs.activities_score, l1.sampleSize],
        ['تقييم التنظيم', l1.organization ?? avgs.organization_score, l1.sampleSize],
        ['الأثر المهني المباشر', l1.immediateImpact ?? avgs.immediate_impact_score, l1.sampleSize],
        ['NPS', l1.nps ?? snap.nps?.index, snap.nps?.totalResponses],
      ]
    )}
    ${table(
      ['مروّجون', 'محايدون', 'منتقدون', 'NPS', 'عدد الردود'],
      [[
        snap.nps?.promoters,
        snap.nps?.passives,
        snap.nps?.detractors,
        snap.nps?.index,
        snap.nps?.totalResponses,
      ]]
    )}
    <h3>${escapeHtml(l2.label || 'المستوى الثاني — Learning')}</h3>
    <p class="muted">${escapeHtml(l2.note || snap.learningImpact?.observation || '')}</p>
    <p class="muted">${escapeHtml(l2.caveat || snap.learningImpact?.caveat || '')}</p>
    ${table(
      ['متوسط الاختبار القبلي', 'متوسط الاختبار البعدي', 'فرق النقاط المئوية', 'نسبة من تحسنت نتائجهم', 'نسبة من بقيت نتائجهم متقاربة', 'نسبة من انخفضت نتائجهم'],
      [[
        l2.averagePre ?? snap.learningImpact?.averagePre,
        l2.averagePost ?? snap.learningImpact?.averagePost,
        l2.averagePp ?? snap.learningImpact?.averagePp,
        l2.improvedPct ?? snap.learningImpact?.improvedPct,
        l2.unchangedPct ?? snap.learningImpact?.unchangedPct,
        l2.decreasedPct ?? snap.learningImpact?.decreasedPct,
      ]]
    )}
    <p class="muted">${escapeHtml(k.level3Reserved?.note || '')}</p>
    <p class="muted">${escapeHtml(k.level4Reserved?.note || '')}</p>
  `;
}

function buildCover(meta, assets) {
  const singleBrand = Boolean(assets.singleBrand || meta.singleBrand);
  const institutionLogo = assets.institutionLogoDataUri
    ? `<img class="logo logo--institution" src="${assets.institutionLogoDataUri}" alt="${escapeHtml(meta.institutionName || 'المؤسسة')}" />`
    : `<div class="logo-fallback">${escapeHtml(meta.institutionName || 'المؤسسة')}</div>`;
  const batLogo = assets.battechnoLogoDataUri
    ? `<img class="logo logo--battechno" src="${assets.battechnoLogoDataUri}" alt="BATTECHNO LMS" />`
    : `<div class="logo-fallback">BATTECHNO LMS</div>`;

  const brands = singleBrand
    ? `<div class="cover__brands cover__brands--single">
      <div class="cover__brand cover__brand--bat">${batLogo}</div>
    </div>`
    : `<div class="cover__brands">
      <div class="cover__brand cover__brand--institution">${institutionLogo}</div>
      <div class="cover__brand cover__brand--bat">${batLogo}</div>
    </div>`;

  const executionLine = singleBrand
    ? `<p><strong>تنفيذ وتشغيل:</strong> ${escapeHtml(meta.institutionName || meta.platformNameAr || 'BATTECHNO')} – ${escapeHtml(meta.platformName || 'BATTECHNO LMS')}</p>`
    : `<p><strong>تنفيذ:</strong> ${escapeHtml(meta.institutionName || '—')}</p>
      <p><strong>بالتعاون مع:</strong> ${escapeHtml(meta.platformNameAr || '')} – ${escapeHtml(meta.platformName || 'BATTECHNO LMS')}</p>`;

  return `
  <section class="cover">
    ${brands}
    <div class="cover__ornament"></div>
    <h1 class="cover__title">${escapeHtml(meta.reportTitle || 'تقرير تدريبي')}</h1>
    <p class="cover__course">${escapeHtml(meta.courseName || '')}</p>
    <div class="cover__meta">
      ${executionLine}
      <p><strong>الفترة:</strong> ${escapeHtml(meta.trainingDates?.startLabel || '—')} – ${escapeHtml(meta.trainingDates?.endLabel || '—')}</p>
      <p><strong>إجمالي الساعات:</strong> ${fmt(meta.totalHours)} ساعة تدريبية</p>
      ${meta.cohorts?.length ? `<p><strong>الدفعات:</strong> ${escapeHtml(meta.cohorts.map((c) => c.name).join('، '))}</p>` : ''}
      ${meta.trainers?.length ? `<p><strong>المدربون:</strong> ${escapeHtml(meta.trainers.map((t) => t.fullName).join('، '))}</p>` : ''}
    </div>
    <div class="cover__footer">
      <span>${escapeHtml(meta.generatedAtLabel || '')}</span>
      <span>${escapeHtml(meta.confidentiality || '')}</span>
    </div>
  </section>`;
}

function buildToc(entries) {
  if (!entries?.length) return '';
  return section(
    'جدول المحتويات',
    `<ol class="toc">${entries.map((e, i) => `<li><a href="#${escapeHtml(e.id)}">${i + 1}. ${escapeHtml(e.title)}</a></li>`).join('')}</ol>`,
    'toc'
  );
}

function renderIndividualSections(snap) {
  const toc = [];
  const blocks = [];
  const add = (id, title, html) => {
    toc.push({ id, title });
    blocks.push(section(title, html, id));
  };

  add(
    'identity',
    'هوية المتدرب',
    table(
      ['الحقل', 'القيمة'],
      [
        ['الاسم', snap.identity?.fullName],
        ['المؤسسة', snap.identity?.institution],
        ['الفرع', snap.identity?.branch],
        ['الدفعة', snap.identity?.cohort],
        ['الدورة', snap.identity?.course],
        ['حالة التسجيل', snap.identity?.enrollmentStatus],
        ['تاريخ البداية', snap.identity?.courseStart],
        ['تاريخ النهاية', snap.identity?.courseEnd],
      ]
    )
  );

  add(
    'exec',
    'الملخص التنفيذي للمتدرب',
    `<div class="kpi-grid">
      ${kpiCard('الحالة النهائية', snap.executiveSummary?.finalStatus)}
      ${kpiCard('نسبة الحضور', snap.executiveSummary?.attendancePct != null ? `${snap.executiveSummary.attendancePct}%` : null)}
      ${kpiCard('الساعات', `${fmt(snap.executiveSummary?.hoursCompleted)} / ${fmt(snap.executiveSummary?.hoursRequired)}`)}
      ${kpiCard('القبلي', snap.executiveSummary?.preTestScore != null ? `${snap.executiveSummary.preTestScore}%` : null)}
      ${kpiCard('البعدي', snap.executiveSummary?.postTestScore != null ? `${snap.executiveSummary.postTestScore}%` : null)}
      ${kpiCard('التحسن', snap.executiveSummary?.improvementPp != null ? `${snap.executiveSummary.improvementPp} ن.م` : null)}
      ${kpiCard('التقييم النهائي', snap.executiveSummary?.evaluationSubmitted ? 'مكتمل' : 'غير مكتمل')}
      ${kpiCard('تاريخ إرسال التقييم', snap.executiveSummary?.evaluationSubmittedAt)}
      ${kpiCard('الشهادة', snap.executiveSummary?.certificateStatus)}
    </div>`
  );

  add(
    'attendance',
    'تفاصيل الحضور',
    `${table(
      ['إجمالي الجلسات', 'حاضر', 'غائب', 'متأخر', 'معذور', 'نسبة الحضور', 'ساعات مكتملة'],
      [[
        snap.attendance?.totalSessions,
        snap.attendance?.present,
        snap.attendance?.absent,
        snap.attendance?.late,
        snap.attendance?.excused,
        snap.attendance?.attendancePctLabel,
        snap.attendance?.hoursCompleted,
      ]]
    )}
    ${table(
      ['الجلسة', 'التاريخ', 'المدة', 'الحالة', 'طريقة التأكيد', 'ملاحظات'],
      (snap.attendance?.sessions || []).map((s) => [s.title, s.dateLabel, s.durationHours, s.status, s.confirmationMethod, s.notes])
    )}`
  );

  add(
    'learning',
    'قياس أثر التعلّم',
    `<div class="callout">${escapeHtml(snap.learningImprovement?.note || '')}</div>
    ${barChart([
      { label: 'قبلي', value: snap.learningImprovement?.preTestScore },
      { label: 'بعدي', value: snap.learningImprovement?.postTestScore },
    ])}
    ${table(
      ['المؤشر', 'القيمة'],
      [
        ['درجة القبلي', snap.preTest?.statusLabel],
        ['درجة البعدي', snap.postTest?.statusLabel],
        ['فرق النقاط المئوية', snap.learningImprovement?.percentagePointDifference],
        ['التحسن النسبي %', snap.learningImprovement?.relativeImprovementLabel || snap.learningImprovement?.relativeImprovementPct],
      ]
    )}`
  );

  add(
    'tasks',
    'المهمات والأنشطة',
    table(
      ['المهمة', 'الموعد', 'التسليم', 'الحالة', 'الدرجة', 'المحاولات'],
      (snap.tasks?.rows || []).map((t) => [t.title, t.deadline, t.submissionDate, t.status, t.grade, t.attempts])
    )
  );

  add(
    'requirements',
    'متطلبات الإكمال',
    table(
      ['المتطلب', 'الحالة'],
      (snap.requirements || []).map((r) => [r.title, r.label])
    )
  );

  add(
    'completion',
    'قرار الإكمال النهائي',
    table(
      ['الحقل', 'القيمة'],
      [
        ['الحالة', snap.completion?.status],
        ['تاريخ الإكمال', snap.completion?.completedAt],
        ['متطلبات ناقصة', (snap.completion?.missingRequirements || []).join('، ') || 'لا يوجد'],
        ['ملاحظات', snap.completion?.notes],
      ]
    )
  );

  add(
    'certificate',
    'معلومات الشهادة',
    table(
      ['الحقل', 'القيمة'],
      [
        ['الحالة', snap.certificate?.status],
        ['رقم الشهادة', snap.certificate?.certificateNumber],
        ['تاريخ الإصدار', snap.certificate?.issueDate],
        ['رمز التحقق', snap.certificate?.verificationCode],
        ['سبب عدم الأهلية', snap.certificate?.ineligibilityReason],
      ]
    )
  );

  add('recommendation', 'التوصية المبنية على القواعد', `<div class="callout callout--accent">${escapeHtml(snap.recommendation || '')}</div>`);

  return { toc, blocks };
}

function renderCourseSections(snap) {
  const toc = [];
  const blocks = [];
  const add = (id, title, html) => {
    toc.push({ id, title });
    blocks.push(section(title, html, id));
  };

  const exec = snap.executiveSummary || {};
  add(
    'exec',
    'الملخص التنفيذي',
    `<div class="kpi-grid">
      ${kpiCard('عدد المتدربين', exec.traineeCount)}
      ${kpiCard('نسبة الإكمال', exec.completionRate != null ? `${exec.completionRate}%` : null)}
      ${kpiCard('نسبة الشهادات', exec.certificateRate != null ? `${exec.certificateRate}%` : null)}
      ${kpiCard('متوسط الحضور', exec.averageAttendance != null ? `${exec.averageAttendance}%` : null)}
      ${kpiCard('متوسط القبلي', exec.preTestAverage)}
      ${kpiCard('متوسط البعدي', exec.postTestAverage)}
      ${kpiCard('فرق التعلم', exec.averageImprovementPp)}
      ${kpiCard('نسبة الاستجابة للتقييم', exec.evaluationResponseRate != null ? `${exec.evaluationResponseRate}%` : null)}
      ${kpiCard('متوسط تقييم المدرب', exec.trainerAverage)}
      ${kpiCard('متوسط تقييم المحتوى', exec.contentAverage)}
      ${kpiCard('متوسط الأثر المباشر', exec.immediateImpactAverage)}
      ${kpiCard('NPS', exec.nps)}
    </div>
    <p class="muted">${escapeHtml(exec.objective || '')}</p>`
  );

  add(
    'course',
    'معلومات الدورة',
    table(
      ['الحقل', 'القيمة'],
      [
        ['الاسم', snap.courseInfo?.name],
        ['الرمز', snap.courseInfo?.code],
        ['المستوى', snap.courseInfo?.level],
        ['لغة التقديم', snap.courseInfo?.language],
        ['نمط التقديم', snap.courseInfo?.deliveryMode],
        ['المؤسسة', snap.courseInfo?.institution],
        ['الفروع', (snap.courseInfo?.branches || []).join('، ')],
        ['المدربون', (snap.courseInfo?.trainers || []).join('، ')],
        ['عدد الجلسات', snap.courseInfo?.sessionCount],
        ['الساعات', snap.courseInfo?.hours],
      ]
    )
  );

  add(
    'funnel',
    'قمع التسجيل',
    table(
      ['المرحلة', 'العدد', '% من الإجمالي', 'التحويل من السابق'],
      (snap.enrollmentFunnel || []).map((s) => [s.label, s.count, s.percentageOfTotal, s.conversionFromPrevious])
    )
  );

  add(
    'attendance',
    'تحليل الحضور',
    `${table(
      ['متوسط', 'وسيط', 'أقل من العتبة', 'ساعات منفّذة', 'ساعات حضور متدربين'],
      [[
        snap.attendance?.average,
        snap.attendance?.median,
        snap.attendance?.belowThreshold,
        snap.attendance?.totalDeliveredHours,
        snap.attendance?.totalAttendedTraineeHours,
      ]]
    )}`
  );

  add(
    'impact',
    'قياس أثر التعلّم',
    `<div class="callout">${escapeHtml(snap.learningImpact?.caveat || '')}</div>
    ${barChart([
      { label: 'متوسط قبلي', value: snap.learningImpact?.averagePre },
      { label: 'متوسط بعدي', value: snap.learningImpact?.averagePost },
    ])}
    ${table(
      ['أزواج مكتملة', 'متوسط فرق ن.م', 'تحسّن', 'ثبات', 'انخفاض'],
      [[
        snap.learningImpact?.pairedCount,
        snap.learningImpact?.averagePp,
        snap.learningImpact?.improved,
        snap.learningImpact?.unchanged,
        snap.learningImpact?.decreased,
      ]]
    )}`
  );

  add(
    'evaluation',
    'التقييم النهائي وفق نموذج Kirkpatrick',
    `${sectionKirkpatrick(snap)}`
  );

  add(
    'completion',
    'تحليل الإكمال والشهادات',
    `${table(
      ['مكتمل', 'غير مكتمل', 'منسحب', 'استثنائي', 'شهادات صادرة'],
      [[
        snap.completion?.completed,
        snap.completion?.notCompleted,
        snap.completion?.withdrawn,
        snap.completion?.exceptional,
        snap.certificates?.issued,
      ]]
    )}
    ${table(
      ['سبب عدم الإكمال', 'العدد'],
      (snap.completion?.reasons || []).map((r) => [r.label, r.count])
    )}`
  );

  add(
    'recommendations',
    'التوصيات وخطة العمل',
    table(
      ['الملاحظة', 'الدليل', 'الأولوية', 'الإجراء المقترح', 'المسؤول'],
      (snap.recommendations || []).map((r) => [r.finding, r.evidence, r.priority, r.recommendedAction, r.responsibleRole])
    )
  );

  if (snap.specializedReportLinks?.length) {
    add(
      'links',
      'التقارير المتخصصة',
      `<ul>${snap.specializedReportLinks.map((l) => `<li>${escapeHtml(l.title)}</li>`).join('')}</ul>`
    );
  }

  return { toc, blocks };
}

function renderGenericSections(snap, reportType) {
  const toc = [{ id: 'summary', title: 'ملخص التقرير' }];
  const blocks = [
    section(
      'ملخص التقرير',
      `<pre class="json-lite">${escapeHtml(JSON.stringify(snap, null, 2).slice(0, 12000))}</pre>
       <p class="muted">عرض موجز — التفاصيل الكاملة في لوحة النظام وملفات Excel.</p>`,
      'summary'
    ),
  ];

  if (snap.summary || snap.note || snap.caveat) {
    toc.push({ id: 'notes', title: 'ملاحظات' });
    blocks.push(section('ملاحظات', `<div class="callout">${escapeHtml(snap.summary || snap.note || snap.caveat)}</div>`, 'notes'));
  }

  if (snap.bySession?.length) {
    toc.push({ id: 'sessions', title: 'الحضور حسب الجلسة' });
    blocks.push(
      section(
        'الحضور حسب الجلسة',
        table(
          ['الجلسة', 'التاريخ', 'حاضر', 'الإجمالي', '%'],
          snap.bySession.map((s) => [s.title, s.dateLabel, s.present, s.total, s.attendancePct])
        ),
        'sessions'
      )
    );
  }

  if (snap.rows?.length) {
    toc.push({ id: 'rows', title: 'البيانات التفصيلية' });
    blocks.push(
      section(
        'البيانات التفصيلية',
        table(
          ['الاسم', 'الحالة', 'الشهادة', 'رقم الشهادة', 'تاريخ الإصدار'],
          snap.rows.slice(0, 200).map((r) => [r.fullName, r.enrollmentStatus, r.certificateStatus, r.certificateNumber, r.issuedAt])
        ),
        'rows'
      )
    );
  }

  if (snap.sections) {
    toc.push({ id: 'scores', title: 'متوسطات المحاور' });
    blocks.push(
      section(
        'متوسطات المحاور',
        table(
          ['المحور', 'المتوسط'],
          Object.entries(snap.sections).map(([k, v]) => [k, v])
        ),
        'scores'
      )
    );
  }

  if (snap.nps) {
    toc.push({ id: 'nps', title: 'NPS' });
    blocks.push(
      section(
        'صافي نقاط الترويج NPS',
        table(
          ['مروّجون', 'محايدون', 'منتقدون', 'المؤشر'],
          [[snap.nps.promoters, snap.nps.passives, snap.nps.detractors, snap.nps.index]]
        ),
        'nps'
      )
    );
  }

  return { toc, blocks };
}

function buildTrainingReportHtml(report, assets = {}, { printable = false } = {}) {
  const snap = report.snapshot_json || report.snapshot || {};
  const meta = {
    ...(snap.meta || {}),
    reportTitle: snap.meta?.reportTitle || report.reportTitle,
    referenceCode: report.reference_code || report.referenceCode,
    version: report.version,
    generatedAtLabel: snap.meta?.generatedAtLabel || String(report.generated_at || '').slice(0, 10),
  };

  let rendered;
  if (report.report_type === 'INDIVIDUAL' || snap.identity) {
    rendered = renderIndividualSections(snap);
  } else if (report.report_type === 'COURSE' || snap.executiveSummary) {
    rendered = renderCourseSections(snap);
  } else {
    rendered = renderGenericSections(snap, report.report_type);
  }

  const singleBrandHeader = Boolean(assets.singleBrand || meta.singleBrand);
  let headerLogosHtml;
  if (singleBrandHeader) {
    headerLogosHtml = assets.battechnoLogoDataUri
      ? `<img src="${assets.battechnoLogoDataUri}" alt="BATTECHNO" />`
      : '<span>BATTECHNO</span>';
  } else {
    const institutionPart = assets.institutionLogoDataUri
      ? `<img src="${assets.institutionLogoDataUri}" alt="" />`
      : `<span>${escapeHtml(meta.institutionName || '')}</span>`;
    const platformPart = assets.battechnoLogoDataUri
      ? `<img src="${assets.battechnoLogoDataUri}" alt="BATTECHNO" />`
      : '<span>BATTECHNO</span>';
    headerLogosHtml = `${institutionPart}${platformPart}`;
  }

  const headerBrand = `
    <div class="page-header">
      <div class="page-header__logos ${singleBrandHeader ? 'page-header__logos--single' : ''}">
        ${headerLogosHtml}
      </div>
      <div class="page-header__text">
        <strong>${escapeHtml(meta.courseName || '')}</strong>
        <span>${escapeHtml(meta.reportTitle || '')}</span>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(meta.reportTitle || 'تقرير')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet" />
  <style>
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
      font-family: 'Tajawal', 'IBM Plex Sans Arabic', sans-serif;
      color: var(--color-text);
      background: ${printable ? '#fff' : 'var(--color-cream)'};
      line-height: 1.7;
    }
    .report { max-width: 920px; margin: 0 auto; padding: 24px; }
    .cover {
      min-height: 90vh;
      background: linear-gradient(160deg, #0e2136 0%, #132d4a 45%, #1e5a8a 100%);
      color: #fff;
      border-radius: 18px;
      padding: 48px 40px;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    .cover__ornament {
      position: absolute; inset: auto -40px -40px auto; width: 220px; height: 220px;
      border: 18px solid rgba(201,162,39,.25); border-radius: 50%;
    }
    .cover__brands { display:flex; justify-content: space-between; align-items: center; gap: 24px; }
    .cover__brands--single { justify-content: center; }
    .logo { height: 64px; width: auto; object-fit: contain; background: rgba(255,255,255,.92); padding: 8px 12px; border-radius: 10px; }
    .logo-fallback { background: rgba(255,255,255,.92); color: var(--color-primary); padding: 12px 16px; border-radius: 10px; font-weight: 700; }
    .cover__title { text-align:center; font-size: 2rem; margin: 48px 0 12px; font-weight: 800; }
    .cover__course { text-align:center; font-size: 1.35rem; color: #f3ead4; margin-bottom: 36px; }
    .cover__meta { max-width: 520px; margin: 0 auto; background: rgba(255,255,255,.08); padding: 20px 24px; border-radius: 14px; }
    .cover__footer { display:flex; justify-content: space-between; margin-top: 48px; font-size: .9rem; opacity: .85; }
    .page-header { display:flex; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--color-border); padding-bottom: 10px; margin: 18px 0 24px; }
    .page-header__logos--single { justify-content: flex-start; }
    .page-header img { height: 28px; width: auto; object-fit: contain; margin-inline-start: 8px; }
    .page-header__logos { display:flex; align-items:center; gap: 8px; }
    .page-header__text { text-align: left; font-size: .85rem; color: #5c6675; }
    .section { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px 22px; margin-bottom: 18px; box-shadow: 0 6px 18px rgba(19,45,74,.05); page-break-inside: avoid; }
    .section h2 { color: var(--color-primary); margin: 0 0 14px; font-size: 1.2rem; }
    .kpi-grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .kpi { background: var(--color-cream); border-radius: 10px; padding: 12px; border: 1px solid var(--color-border); }
    .kpi__label { font-size: .8rem; color: #5c6675; }
    .kpi__value { font-size: 1.15rem; font-weight: 700; color: var(--color-primary); margin-top: 4px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    .data-table th { background: var(--color-primary); color: #fff; padding: 8px 10px; text-align: right; }
    .data-table td { padding: 8px 10px; border-bottom: 1px solid var(--color-border); text-align: right; }
    .data-table tr.alt td { background: #f8fafc; }
    .callout { background: #e7edf4; border-right: 4px solid var(--color-action); padding: 12px 14px; border-radius: 8px; }
    .callout--accent { border-right-color: var(--color-accent); background: #f3ead4; }
    .muted { color: #5c6675; font-size: .9rem; }
    .toc { padding-inline-start: 1.2rem; }
    .toc a { color: var(--color-action); text-decoration: none; }
    .bars { display:flex; flex-direction: column; gap: 8px; margin: 12px 0; }
    .bar { display:grid; grid-template-columns: 90px 1fr 50px; gap: 8px; align-items:center; }
    .bar__track { height: 10px; background: #e7edf4; border-radius: 999px; overflow:hidden; }
    .bar__fill { height: 100%; background: linear-gradient(90deg, var(--color-action), var(--color-accent)); }
    .json-lite { white-space: pre-wrap; font-size: .75rem; background: #f8fafc; padding: 12px; border-radius: 8px; max-height: 320px; overflow: hidden; }
    .doc-footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--color-border); display:flex; justify-content: space-between; font-size: .8rem; color: #5c6675; }
    @media print {
      body { background: #fff; }
      .report { max-width: none; padding: 0; }
      .cover { border-radius: 0; min-height: 100vh; }
      .section { box-shadow: none; }
    }
    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .cover__brands { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <article class="report">
    ${buildCover(meta, assets)}
    ${headerBrand}
    ${buildToc(rendered.toc)}
    ${rendered.blocks.join('\n')}
    <footer class="doc-footer">
      <span>المرجع: ${escapeHtml(meta.referenceCode || '—')} · الإصدار ${escapeHtml(meta.version || report.version || 1)}</span>
      <span>${escapeHtml(meta.generatedAtLabel || '')}</span>
      <span>${escapeHtml(meta.confidentiality || 'للاستخدام المؤسسي')}</span>
    </footer>
  </article>
</body>
</html>`;
}

module.exports = {
  buildTrainingReportHtml,
  escapeHtml,
};
