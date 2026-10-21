/**
 * Branded Field Training Plan PDF (Arabic RTL) — eprojecto / BATMAN TECHNOLOGY theme.
 * Colors mirror internship-journey identity: navy #132d4a, gold #c9a227, cream paper.
 */

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateAr(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      timeZone: 'Asia/Amman',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function barWidth(hours, total) {
  if (!total) return 0;
  return Math.max(6, Math.round((hours / total) * 100));
}

/**
 * @param {{
 *   profile: object,
 *   allocation: object,
 *   intensity: object|null,
 *   logoDataUri?: string|null,
 *   generatedAt?: Date,
 * }} input
 */
function buildInternshipPlanPdfHtml(input) {
  const profile = input.profile || {};
  const allocation = input.allocation || {};
  const intensity = input.intensity || null;
  const logo = input.logoDataUri || null;
  const generatedAt = input.generatedAt || new Date();
  const total = Number(allocation.total || profile.trainingHours || 0);

  const structure = [
    {
      key: 'foundation',
      labelAr: 'الأساس المهني',
      labelEn: 'Professional Foundation',
      hours: allocation.foundation,
      pct: 20,
      tone: '#132d4a',
    },
    {
      key: 'specialization',
      labelAr: 'التخصص',
      labelEn: 'Specialized Training',
      hours: allocation.specialization,
      pct: 45,
      tone: '#3a5f8a',
    },
    {
      key: 'tasks',
      labelAr: 'المهام العملية',
      labelEn: 'Practical Tasks',
      hours: allocation.tasks,
      pct: 20,
      tone: '#327d82',
    },
    {
      key: 'finalProject',
      labelAr: 'المشروع النهائي والمحفظة',
      labelEn: 'Final Project / Portfolio',
      hours: allocation.finalProject,
      pct: 15,
      tone: '#a8861c',
    },
  ];

  const pendingBanner = profile.trackConfigured
    ? ''
    : `<div class="banner banner--warn">سيتم تجهيز المسار التدريبي المناسب لهذا التخصص — هذه وثيقة استرشادية أولية.</div>`;

  const metaRows = [
    ['الجامعة', profile.universityName],
    ['الكلية', profile.facultyName],
    ['التخصص', profile.majorLabelAr],
    ['ساعات التدريب', `${profile.trainingHours} ساعة`],
    ['كثافة المسار', intensity?.labelAr || '—'],
    ['رمز المسار', profile.trackCode || '—'],
  ]
    .map(
      ([k, v]) => `
      <div class="meta-cell">
        <span class="meta-label">${esc(k)}</span>
        <strong class="meta-value">${esc(v)}</strong>
      </div>`
    )
    .join('');

  const structureRows = structure
    .map((row) => {
      const w = barWidth(row.hours, total);
      return `
      <div class="stage">
        <div class="stage-head">
          <div>
            <div class="stage-title">${esc(row.labelAr)}</div>
            <div class="stage-en" lang="en" dir="ltr">${esc(row.labelEn)}</div>
          </div>
          <div class="stage-hours">
            <strong>${esc(row.hours)}</strong>
            <span>ساعة · ${esc(row.pct)}%</span>
          </div>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${w}%;background:${esc(row.tone)}"></div>
        </div>
      </div>`;
    })
    .join('');

  const logoBlock = logo
    ? `<img class="logo" src="${logo}" alt="eprojecto" width="168" height="52" />`
    : `<div class="logo-fallback">eprojecto</div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>خطة التدريب الميداني — eprojecto</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #132d4a;
      background: #fcfaf5;
      font-family: Cairo, Tahoma, "Noto Naskh Arabic", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0 0 28mm;
      background:
        radial-gradient(circle at 8% 6%, #f3ead4 0%, transparent 42%),
        radial-gradient(circle at 92% 12%, #e5edf4 0%, transparent 40%),
        linear-gradient(180deg, #fffefc 0%, #fcfaf5 55%, #f7f3ea 100%);
      position: relative;
      overflow: hidden;
    }
    .page::before {
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 7px;
      background: linear-gradient(90deg, #132d4a 0%, #3a5f8a 45%, #c9a227 100%);
    }
    .inner { padding: 22mm 16mm 10mm; position: relative; z-index: 1; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e4dccb;
    }
    .brand-meta {
      text-align: left;
      direction: ltr;
      font-family: Outfit, Cairo, sans-serif;
      color: #5c6b7c;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      line-height: 1.55;
      text-transform: uppercase;
    }
    .logo { display: block; max-width: 168px; height: auto; }
    .logo-fallback {
      font-family: Outfit, Cairo, sans-serif;
      font-weight: 800;
      font-size: 28px;
      color: #132d4a;
      letter-spacing: 0.04em;
    }
    .eyebrow {
      display: inline-block;
      font-family: Outfit, Cairo, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #a8861c;
      margin: 0 0 8px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 900;
      line-height: 1.25;
      color: #132d4a;
    }
    .lead {
      margin: 0 0 18px;
      color: #5a6578;
      font-size: 13.5px;
      line-height: 1.7;
      max-width: 520px;
    }
    .hero-card {
      border: 1px solid #e8e1d5;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(255,254,252,0.95), rgba(243,234,212,0.35));
      padding: 18px 18px 16px;
      margin-bottom: 16px;
      box-shadow: 0 18px 40px rgba(19, 45, 74, 0.06);
    }
    .track-name {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      color: #132d4a;
    }
    .track-en {
      margin: 4px 0 0;
      font-family: Outfit, Cairo, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #3a5f8a;
      letter-spacing: 0.02em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 16px 0 0;
    }
    .meta-cell {
      background: #fffefc;
      border: 1px solid #ebe4d6;
      border-radius: 12px;
      padding: 10px 12px;
    }
    .meta-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #8a7a55;
      margin-bottom: 3px;
    }
    .meta-value {
      display: block;
      font-size: 14px;
      font-weight: 800;
      color: #132d4a;
      line-height: 1.45;
    }
    .section {
      margin-top: 18px;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e6dfd0;
    }
    .section-title h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 900;
    }
    .section-title span {
      font-family: Outfit, Cairo, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #a8861c;
    }
    .hours-pill {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      background: #132d4a;
      color: #f8f4ea;
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 800;
      margin-bottom: 12px;
    }
    .hours-pill strong { font-size: 20px; font-family: Outfit, Cairo, sans-serif; }
    .hours-pill span { font-size: 12px; opacity: 0.85; }
    .stage {
      background: #fffefc;
      border: 1px solid #ebe4d6;
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .stage-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .stage-title { font-size: 14px; font-weight: 800; }
    .stage-en {
      font-family: Outfit, Cairo, sans-serif;
      font-size: 11px;
      color: #6b7a8c;
      margin-top: 2px;
    }
    .stage-hours { text-align: left; direction: ltr; }
    .stage-hours strong {
      display: block;
      font-family: Outfit, Cairo, sans-serif;
      font-size: 18px;
      color: #132d4a;
      line-height: 1;
    }
    .stage-hours span { font-size: 10px; color: #7a8696; font-weight: 700; }
    .bar-track {
      height: 7px;
      border-radius: 999px;
      background: #ece7db;
      overflow: hidden;
    }
    .bar-fill { height: 100%; border-radius: 999px; }
    .project-box {
      margin-top: 8px;
      border-radius: 16px;
      border: 1px solid #e2d4a8;
      background: linear-gradient(120deg, #f8f1de, #fffefc 60%);
      padding: 14px 16px;
    }
    .project-box .label {
      font-size: 11px;
      font-weight: 800;
      color: #795f1a;
      margin-bottom: 4px;
    }
    .project-box .value {
      font-family: Outfit, Cairo, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #132d4a;
      line-height: 1.45;
    }
    .banner {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.55;
    }
    .banner--warn {
      background: #fff4df;
      color: #6b5931;
      border: 1px solid #ead7a4;
    }
    .notes {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .note {
      border-radius: 12px;
      padding: 12px;
      background: #f3f6f8;
      border: 1px solid #dde5ec;
      font-size: 12px;
      line-height: 1.65;
      color: #41576d;
    }
    .note strong { display: block; color: #132d4a; margin-bottom: 4px; font-size: 12.5px; }
    .disclaimer {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px dashed #d9d0bc;
      font-size: 11px;
      color: #7a8696;
      line-height: 1.7;
    }
    .stamp {
      margin-top: 10px;
      font-family: Outfit, Cairo, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #a8861c;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="inner">
      <div class="topbar">
        ${logoBlock}
        <div class="brand-meta">
          BATMAN TECHNOLOGY<br />
          FIELD TRAINING JOURNEY<br />
          ${esc(formatDateAr(generatedAt))}
        </div>
      </div>

      <div class="eyebrow">Internship Plan Document</div>
      <h1>خطة التدريب الميداني المقترحة</h1>
      <p class="lead">
        وثيقة استرشادية مبنية على اختيارك الأكاديمي وعدد ساعات التدريب المطلوبة عبر منصة eprojecto —
        جاهزة للمراجعة قبل بدء خطوات الالتحاق الرسمية.
      </p>

      <div class="hero-card">
        <div class="eyebrow">Recommended Track</div>
        <h2 class="track-name">${esc(profile.trackNameAr)}</h2>
        <p class="track-en" lang="en" dir="ltr">${esc(profile.trackNameEn)}</p>
        ${pendingBanner}
        <div class="meta-grid">${metaRows}</div>
      </div>

      <div class="section">
        <div class="section-title">
          <h2>هيكل الساعات التقديري</h2>
          <span>Hour Allocation</span>
        </div>
        <div class="hours-pill">
          <strong>${esc(total)}</strong>
          <span>ساعة تدريب إجمالية</span>
        </div>
        ${structureRows}
      </div>

      <div class="section">
        <div class="section-title">
          <h2>المشروع النهائي</h2>
          <span>Capstone</span>
        </div>
        <div class="project-box">
          <div class="label">المخرج المتوقع</div>
          <div class="value" lang="en" dir="ltr">${esc(profile.finalProject || '—')}</div>
        </div>
      </div>

      <div class="notes">
        <div class="note">
          <strong>ماذا تتضمن الرحلة؟</strong>
          أساس مهني، تدريب تخصصي، مهام عملية قابلة للتسليم، ومشروع نهائي مع محفظة أعمال مختصرة.
        </div>
        <div class="note">
          <strong>الخطوة التالية</strong>
          أكمل طلب الالتحاق عبر eprojecto وارفق متطلبات جامعتك. يمكن تكييف الخطة مع كتاب التدريب المعتمد لدى الكلية.
        </div>
      </div>

      <div class="disclaimer">
        هذه الوثيقة خطة استرشادية صادرة عن eprojecto / BATMAN TECHNOLOGY لأغراض التوجيه الأكاديمي والتهيئة للتدريب الميداني.
        لا تُعد شهادة إنجاز، ولا تعهداً بالتوظيف، ولا بديلاً عن المتطلبات الرسمية الصادرة عن الجامعة أو جهة التدريب.
      </div>
      <div class="stamp">eprojecto · Amman, Jordan · Confidential intake draft</div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  buildInternshipPlanPdfHtml,
  esc,
};
