'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const hoursMod = require('./fieldTraining.hours');
const {
  resolveOfficialUniversityNumber,
  STUDENT_NUMBER_UNRESOLVED_CODE,
} = require('./fieldTrainingEvaluation.universityNumber');

const MIN_COMPLETED_HOURS = 140;
const OFFICER_TITLE = 'مسؤول التدريب';
const OFFICER_NAME = 'عاصم القيسي';
const LETTER_TITLE = 'كتاب إنهاء تدريب ميداني';
const FONT_FAMILY = 'Sakkal Majalla';

const FONT_REGULAR = path.join(__dirname, '../../../assets/fonts/SakkalMajalla.ttf');
const FONT_BOLD = path.join(__dirname, '../../../assets/fonts/SakkalMajalla-Bold.ttf');
const LOGO_PATH = path.join(
  __dirname,
  '../../../assets/field-training/completion-letter/batman-technology-logo.png'
);
const STAMP_PATH = path.join(
  __dirname,
  '../../../assets/field-training/completion-letter/official-company-stamp.png'
);

const ELIGIBILITY_AR = {
  eligible: 'مؤهل',
  pending: 'قيد المراجعة',
  ineligible: 'غير مؤهل',
  needs_review: 'يحتاج مراجعة',
};

let cachedAssets = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDataUri(absPath, mime) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function loadLetterAssets() {
  if (cachedAssets) return cachedAssets;
  const fontRegular = toDataUri(FONT_REGULAR, 'font/ttf');
  const fontBold = toDataUri(FONT_BOLD, 'font/ttf');
  const logo = toDataUri(LOGO_PATH, 'image/png');
  const stamp = toDataUri(STAMP_PATH, 'image/png');
  const missing = [];
  if (!fontRegular) missing.push('Sakkal Majalla (SakkalMajalla.ttf)');
  if (!fontBold) missing.push('Sakkal Majalla Bold (SakkalMajalla-Bold.ttf)');
  if (!logo) missing.push('شعار BATMAN TECHNOLOGY');
  if (!stamp) missing.push('الختم الرسمي');
  cachedAssets = {
    fontRegular,
    fontBold,
    logo,
    stamp,
    missing,
    ready: missing.length === 0,
  };
  return cachedAssets;
}

function assertLetterAssets() {
  const assets = loadLetterAssets();
  if (!assets.ready) {
    throw new ApiError(
      500,
      `تعذر إنشاء كتاب الإنهاء لأن الأصول التالية غير موجودة في ملفات المنصة: ${assets.missing.join('، ')}.`,
      { missing: assets.missing },
      'COMPLETION_LETTER_ASSETS_MISSING'
    );
  }
  return assets;
}

function formatArDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Asia/Amman',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildDownloadFilename(studentName, universityNumber) {
  const name = sanitizeFilenamePart(studentName) || 'طالب';
  const number = sanitizeFilenamePart(universityNumber) || 'بدون_رقم';
  return `${name}_${number}_كتاب_إنهاء_التدريب.pdf`;
}

function buildContentDisposition(filename, inline = false) {
  const raw = sanitizeFilenamePart(String(filename || 'كتاب_إنهاء_التدريب.pdf').replace(/\.pdf$/i, '')) + '.pdf';
  const ascii = raw
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
  const fallback = ascii.endsWith('.pdf') ? ascii : `${ascii || 'completion-letter'}.pdf`;
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function buildGenerationIdentity({ applicationId, studentId, opportunityId, updatedAt }) {
  const stamp =
    updatedAt instanceof Date
      ? updatedAt.toISOString()
      : String(updatedAt || '') || new Date().toISOString();
  const raw = [applicationId, studentId, opportunityId, stamp].map((v) => String(v || '')).join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

function completedHoursOf(app, hoursProgress) {
  const fromProgress = hoursProgress?.completed_training_hours;
  if (fromProgress != null && Number.isFinite(Number(fromProgress))) {
    return Number(fromProgress);
  }
  return hoursMod.toNullableInt(app?.completed_training_hours) || 0;
}

function evaluateLetterEligibility(app, completedHours) {
  const reasons = [];
  const hours = Number(completedHours) || 0;
  const status = app?.completion_eligibility_status || 'pending';
  if (status !== 'eligible') {
    reasons.push('لا يمكن إنشاء كتاب الإنهاء لأن حالة الأهلية ليست «مؤهل».');
  }
  if (hours < MIN_COMPLETED_HOURS) {
    reasons.push(
      `لا يمكن إنشاء كتاب الإنهاء لأن الساعات التدريبية المنجزة (${hours}) أقل من ${MIN_COMPLETED_HOURS} ساعة.`
    );
  }
  return {
    allowed: reasons.length === 0,
    reasons,
    completed_hours: hours,
    eligibility_status: status,
    eligibility_label: ELIGIBILITY_AR[status] || status,
    min_hours: MIN_COMPLETED_HOURS,
  };
}

function assertLetterEligible(app, completedHours) {
  const gate = evaluateLetterEligibility(app, completedHours);
  if (!gate.allowed) {
    throw new ApiError(400, gate.reasons.join(' '), gate, 'COMPLETION_LETTER_NOT_ELIGIBLE');
  }
  return gate;
}

function resolveLetterUniversityNumber(student) {
  const resolved = resolveOfficialUniversityNumber(student);
  if (!resolved.number) {
    throw new ApiError(
      400,
      'لا يمكن إنشاء كتاب الإنهاء لأن الرقم الجامعي غير متوفر لهذا الطالب. يجب حفظ رقم جامعي صالح، أو استخدام بريد جامعي موثّق يبدأ برقم من 6 إلى 12 خانة.',
      { source: resolved.source },
      STUDENT_NUMBER_UNRESOLVED_CODE
    );
  }
  return resolved;
}

function buildOfficialParagraph(payload) {
  const name = payload.studentName;
  const number = payload.universityNumber;
  const university = payload.universityName;
  const hours = payload.completedHours;
  const start = payload.startDateLabel;
  const end = payload.endDateLabel;
  return [
    `تشهد شركة الرجل الوطواط للتكنولوجيا بأن الطالب/الطالبة ${name}، والرقم الجامعي ${number}، من ${university}، قد أتم/أتمت متطلبات التدريب الميداني لدى الشركة بنجاح، بواقع ${hours} ساعة تدريبية، خلال الفترة من ${start} إلى ${end}.`,
    'وقد أظهر/أظهرت خلال فترة التدريب الالتزام والتعاون والقدرة على تطبيق المهارات والمعارف المكتسبة، وقد مُنح/مُنحت هذا الكتاب بناءً على طلبه/طلبها دون أن يترتب على الشركة أي التزام آخر.',
    'مع تمنياتنا له/لها بدوام التوفيق والنجاح.',
  ];
}

function buildLetterPayload({
  app,
  opportunity,
  student,
  hoursProgress,
  letter,
  issuedAt,
  isDraft = false,
}) {
  const universityNumber = resolveLetterUniversityNumber(student).number;
  const completedHours = completedHoursOf(app, hoursProgress);
  const startRaw = opportunity.start_date || opportunity.training_start_date || null;
  const endRaw = opportunity.end_date || opportunity.training_end_date || null;
  const issueDate = issuedAt || letter?.issued_at || new Date();
  const eligibilityLabel =
    ELIGIBILITY_AR[app.completion_eligibility_status] || app.completion_eligibility_status || '—';

  return {
    applicationId: app.id,
    studentId: app.student_id,
    opportunityId: app.opportunity_id || opportunity.id,
    updatedAt: app.updated_at || letter?.updated_at || new Date(),
    studentName: student.full_name || '—',
    universityNumber,
    universityName: student.university?.name || '—',
    specialtyName: student.specialty?.name_ar || student.specialty?.name_en || '—',
    opportunityTitle: opportunity.title || '—',
    startDateLabel: formatArDate(startRaw) || '—',
    endDateLabel: formatArDate(endRaw) || '—',
    completedHours,
    eligibilityLabel,
    issueDateLabel: formatArDate(issueDate) || '—',
    letterNo: isDraft ? 'مسودة — لم يصدر بعد' : letter?.letter_no || '—',
    verificationCode: isDraft ? '' : letter?.verification_code || '',
    isDraft: Boolean(isDraft),
    officerTitle: OFFICER_TITLE,
    officerName: OFFICER_NAME,
  };
}

function buildCompletionLetterHtml(payload) {
  const assets = assertLetterAssets();
  const paragraphs = buildOfficialParagraph(payload).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
  const infoRows = [
    ['اسم الطالب/ة', payload.studentName],
    ['الرقم الجامعي', payload.universityNumber],
    ['الجامعة', payload.universityName],
    ['التخصص', payload.specialtyName],
    ['فرصة التدريب', payload.opportunityTitle],
    ['فترة التدريب', `${payload.startDateLabel} — ${payload.endDateLabel}`],
    ['الساعات التدريبية المنجزة', `${payload.completedHours} ساعة`],
    ['حالة الأهلية', payload.eligibilityLabel],
    ['تاريخ الإصدار', payload.issueDateLabel],
    ['رقم الكتاب', payload.letterNo],
  ]
    .map(
      ([label, value]) =>
        `<div class="info-row"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span></div>`
    )
    .join('');

  const verification = payload.verificationCode
    ? `<div class="verify">رمز التحقق: ${escapeHtml(payload.verificationCode)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(LETTER_TITLE)}</title>
<style>
  @font-face {
    font-family: '${FONT_FAMILY}';
    src: url('${assets.fontRegular}') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }
  @font-face {
    font-family: '${FONT_FAMILY}';
    src: url('${assets.fontBold}') format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    height: 297mm;
    background: #fffdf8;
    color: #0b1f3a;
    font-family: '${FONT_FAMILY}';
    font-weight: 400;
    direction: rtl;
    text-align: right;
    unicode-bidi: isolate;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 14mm 16mm 12mm;
    position: relative;
    overflow: hidden;
    background: #fffdf8;
  }
  .page::before {
    content: '';
    position: absolute;
    inset: 7mm;
    border: 0.35mm solid #0b1f3a;
    pointer-events: none;
  }
  .logo {
    display: block;
    margin: 0 auto 5px;
    height: 28mm;
    width: auto;
    max-width: 148mm;
    object-fit: contain;
    object-position: center;
  }
  .header-rule {
    height: 1.15mm;
    background: #0b1f3a;
    margin: 2mm 0 0;
  }
  .header-gold {
    height: 0.45mm;
    background: #c5a057;
    margin: 1.1mm 0 5mm;
  }
  h1 {
    margin: 0 0 3mm;
    text-align: center;
    font-size: 22pt;
    font-weight: 700;
    color: #0b1f3a;
    letter-spacing: 0;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    gap: 8mm;
    font-size: 11.5pt;
    color: #3b4a63;
    margin-bottom: 4mm;
  }
  .recipient {
    text-align: center;
    font-size: 15pt;
    font-weight: 700;
    margin: 0 0 4mm;
  }
  .body p {
    margin: 0 0 3mm;
    font-size: 12.7pt;
    line-height: 1.85;
    text-align: justify;
    text-justify: inter-word;
  }
  .info {
    border: 0.28mm solid #d7deea;
    background: #f7f4ec;
    padding: 3mm 4mm;
    margin: 3mm 0 4mm;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 6mm;
    padding: 1.1mm 0;
    border-bottom: 0.18mm solid #e6e0d2;
    font-size: 11.6pt;
  }
  .info-row:last-child { border-bottom: 0; }
  .info-label { color: #5a6578; min-width: 42mm; }
    .info-value {
      font-weight: 700;
      color: #0b1f3a;
      text-align: right;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  .sign-wrap {
    position: relative;
    min-height: 52mm;
    margin-top: 1mm;
  }
  .sign-text {
    position: absolute;
    top: 10mm;
    right: 4mm;
    text-align: center;
    z-index: 2;
  }
  .sign-role {
    font-size: 12.5pt;
    color: #3b4a63;
    margin-bottom: 1mm;
  }
  .sign-name {
    font-size: 16pt;
    font-weight: 700;
    color: #0b1f3a;
  }
  .stamp {
    position: absolute;
    left: 8mm;
    bottom: 1mm;
    height: 50mm;
    width: auto;
    max-width: 52mm;
    object-fit: contain;
    object-position: center;
    z-index: 1;
  }
  .footer {
    position: absolute;
    right: 16mm;
    left: 16mm;
    bottom: 9mm;
    text-align: center;
    font-size: 9.5pt;
    color: #5a6578;
    border-top: 0.28mm solid #c5a057;
    padding-top: 2.2mm;
  }
  .verify { margin-top: 0.8mm; font-size: 9pt; color: #7a8494; }
</style>
</head>
<body>
  <div class="page">
    <img class="logo" src="${assets.logo}" alt="BATMAN TECHNOLOGY"/>
    <div class="header-rule"></div>
    <div class="header-gold"></div>
    <h1>${escapeHtml(LETTER_TITLE)}</h1>
    <div class="meta">
      <span>تاريخ الإصدار: ${escapeHtml(payload.issueDateLabel)}</span>
      <span>الرقم المرجعي: ${escapeHtml(payload.letterNo)}</span>
    </div>
    <div class="recipient">إلى من يهمه الأمر</div>
    <div class="body">${paragraphs}</div>
    <div class="info">${infoRows}</div>
    <div class="sign-wrap">
      <div class="sign-text">
        <div class="sign-role">${escapeHtml(payload.officerTitle)}</div>
        <div class="sign-name">${escapeHtml(payload.officerName)}</div>
      </div>
      <img class="stamp" src="${assets.stamp}" alt=""/>
    </div>
    <div class="footer">
      شركة الرجل الوطواط للتكنولوجيا · المملكة الأردنية الهاشمية — عمّان · privacy@battechno.com
      ${verification}
    </div>
  </div>
</body>
</html>`;
}

async function renderCompletionLetterPdf(payload) {
  const html = buildCompletionLetterHtml(payload);
  return renderHtmlToPdf(html, {
    lang: 'ar',
    displayHeaderFooter: false,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    waitForFonts: true,
    requiredFontFamily: FONT_FAMILY,
  });
}

function attachLetterGate(progress, app) {
  if (!progress?.metrics) return progress;
  const hours = Number(progress.metrics.completed_training_hours) || 0;
  progress.metrics.completion_letter_gate = evaluateLetterEligibility(app, hours);
  return progress;
}

module.exports = {
  MIN_COMPLETED_HOURS,
  OFFICER_TITLE,
  OFFICER_NAME,
  LETTER_TITLE,
  FONT_FAMILY,
  FONT_REGULAR,
  FONT_BOLD,
  LOGO_PATH,
  STAMP_PATH,
  loadLetterAssets,
  assertLetterAssets,
  escapeHtml,
  formatArDate,
  sanitizeFilenamePart,
  buildDownloadFilename,
  buildContentDisposition,
  buildGenerationIdentity,
  completedHoursOf,
  evaluateLetterEligibility,
  assertLetterEligible,
  resolveLetterUniversityNumber,
  buildOfficialParagraph,
  buildLetterPayload,
  buildCompletionLetterHtml,
  renderCompletionLetterPdf,
  attachLetterGate,
};
