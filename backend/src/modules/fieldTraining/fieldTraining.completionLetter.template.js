'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SIGNATORY_TITLE = 'مسؤول التدريب';
const SIGNATORY_NAME = 'عاصم القيسي';
const LETTER_TITLE = 'كتاب إنهاء تدريب ميداني';
const FONT_FAMILY = 'Sakkal Majalla';
const MIN_COMPLETION_LETTER_HOURS = 140;
const TEMPLATE_VERSION = 'official-batman-v1';

const FONT_REGULAR = path.join(__dirname, '../../../assets/fonts/SakkalMajalla.ttf');
const FONT_BOLD = path.join(__dirname, '../../../assets/fonts/SakkalMajalla-Bold.ttf');
const OFFICIAL_LOGO = path.join(
  __dirname,
  '../../../assets/field-training/completion-letter/batman-technology-logo.png'
);
const OFFICIAL_STAMP = path.join(
  __dirname,
  '../../../assets/field-training/completion-letter/official-company-stamp.png'
);
const FALLBACK_LOGO = path.join(__dirname, 'assets', 'battechno-logo.png');
const FALLBACK_STAMP = path.join(__dirname, 'assets', 'battechno-stamp.svg');

const FONT_CANDIDATES = [
  process.env.SAKKAL_MAJALLA_FONT_PATH,
  FONT_REGULAR,
  'C:\\Windows\\Fonts\\majalla.ttf',
  'C:\\Windows\\Fonts\\SakkalMajalla.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/SakkalMajalla.ttf',
].filter(Boolean);

const { log } = require('../../utils/logger');

let cachedFontCss = null;
let cachedLogoUri = null;
let cachedStampUri = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDataUri(absPath, mime) {
  try {
    if (!absPath || !fs.existsSync(absPath)) return '';
    return `data:${mime};base64,${fs.readFileSync(absPath).toString('base64')}`;
  } catch {
    return '';
  }
}

function loadFontFaceCss() {
  if (cachedFontCss != null) return cachedFontCss;
  const faces = [];
  let regularUri = '';
  for (const candidate of FONT_CANDIDATES) {
    regularUri = toDataUri(candidate, 'font/ttf');
    if (regularUri) break;
  }
  const boldUri = toDataUri(FONT_BOLD, 'font/ttf');
  if (regularUri) {
    faces.push(
      `@font-face { font-family: '${FONT_FAMILY}'; src: url('${regularUri}') format('truetype'); font-weight: 400; font-style: normal; font-display: block; }`
    );
  }
  if (boldUri) {
    faces.push(
      `@font-face { font-family: '${FONT_FAMILY}'; src: url('${boldUri}') format('truetype'); font-weight: 700; font-style: normal; font-display: block; }`
    );
  }
  if (!faces.length) {
    log('warn', 'MISSING_FONT', { font: FONT_FAMILY, code: 'MISSING_FONT' });
    cachedFontCss = '';
    return cachedFontCss;
  }
  cachedFontCss = faces.join('\n');
  return cachedFontCss;
}

function loadLogoDataUri() {
  if (cachedLogoUri != null) return cachedLogoUri;
  cachedLogoUri = toDataUri(OFFICIAL_LOGO, 'image/png') || toDataUri(FALLBACK_LOGO, 'image/png');
  if (!cachedLogoUri) log('warn', 'LOGO_NOT_FOUND', { code: 'LOGO_NOT_FOUND' });
  return cachedLogoUri;
}

function loadStampDataUri() {
  if (cachedStampUri != null) return cachedStampUri;
  cachedStampUri = toDataUri(OFFICIAL_STAMP, 'image/png');
  if (!cachedStampUri) {
    const svg = toDataUri(FALLBACK_STAMP, 'image/svg+xml');
    cachedStampUri = svg;
  }
  if (!cachedStampUri) log('warn', 'STAMP_NOT_FOUND', { code: 'STAMP_NOT_FOUND' });
  return cachedStampUri;
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

function computeLetterSourceHash(data) {
  const payload = [
    TEMPLATE_VERSION,
    data.studentId || '',
    data.applicationId || '',
    data.studentName || '',
    data.universityNumber || '',
    data.universityName || '',
    data.specialtyName || '',
    data.opportunityTitle || '',
    data.startDate || '',
    data.endDate || '',
    data.completedHours == null ? '' : String(data.completedHours),
    data.attendancePct == null ? '' : String(data.attendancePct),
    data.postScore == null ? '' : String(data.postScore),
    SIGNATORY_NAME,
    SIGNATORY_TITLE,
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

const INFO_SECTION_CSS = `
  .info {
    border: 0.28mm solid #d7deea;
    background: #f7f4ec;
    padding: 3mm 4mm;
    margin: 3mm 0 4mm;
    direction: rtl;
    text-align: right;
  }
  .info-row {
    padding: 1.1mm 0;
    border-bottom: 0.18mm solid #e6e0d2;
    font-size: 11.6pt;
    line-height: 1.6;
    text-align: right;
  }
  .info-row:last-child { border-bottom: 0; }
  .info-label {
    color: #5a6578;
    font-weight: 600;
    display: inline;
  }
  .info-value {
    font-weight: 700;
    color: #0b1f3a;
    display: inline;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .info-value--ltr {
    direction: ltr;
    unicode-bidi: embed;
    display: inline;
  }`;

function needsIsolatedLtrInfoValue(label, value) {
  if (label === 'رقم الكتاب') return true;
  const text = String(value ?? '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(text);
}

function buildInfoRowHtml(label, value) {
  const safeLabel = escapeHtml(label);
  const safeValue = escapeHtml(value);
  const valueClass = needsIsolatedLtrInfoValue(label, value)
    ? 'info-value info-value--ltr'
    : 'info-value';
  return `<div class="info-row"><span class="info-label">${safeLabel}:</span> <span class="${valueClass}">${safeValue}</span></div>`;
}

function buildOfficialParagraphs(data) {
  const name = data.studentName || '—';
  const number = data.universityNumber || '—';
  const university = data.universityName || '—';
  const hours = data.completedHours != null ? String(data.completedHours) : '—';
  const start = formatArDate(data.startDate) || data.startDate || '—';
  const end = formatArDate(data.endDate) || data.endDate || '—';
  return [
    `تشهد شركة الرجل الوطواط للتكنولوجيا بأن الطالب/الطالبة ${name}، والرقم الجامعي ${number}، من ${university}، قد أتم/أتمت متطلبات التدريب الميداني لدى الشركة بنجاح، بواقع ${hours} ساعة تدريبية، خلال الفترة من ${start} إلى ${end}.`,
    'وقد أظهر/أظهرت خلال فترة التدريب الالتزام والتعاون والقدرة على تطبيق المهارات والمعارف المكتسبة، وقد مُنح/مُنحت هذا الكتاب بناءً على طلبه/طلبها دون أن يترتب على الشركة أي التزام آخر.',
    'مع تمنياتنا له/لها بدوام التوفيق والنجاح.',
  ];
}

function buildOfficialCompletionLetterHtml(data) {
  const fontCss = loadFontFaceCss();
  const logo = loadLogoDataUri();
  const stamp = loadStampDataUri();
  const fontStack = `'${FONT_FAMILY}', 'Traditional Arabic', Tahoma, Arial, sans-serif`;
  const paragraphs = buildOfficialParagraphs(data)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  const startLabel = formatArDate(data.startDate) || data.startDate || '—';
  const endLabel = formatArDate(data.endDate) || data.endDate || '—';
  const issueLabel = formatArDate(data.issuedAt) || data.issuedAt || '—';
  const infoRows = [
    ['اسم الطالب/ة', data.studentName || '—'],
    ['الرقم الجامعي', data.universityNumber || '—'],
    ['الجامعة', data.universityName || '—'],
    ['التخصص', data.specialtyName || '—'],
    ['فرصة التدريب', data.opportunityTitle || '—'],
    ['فترة التدريب', `${startLabel} — ${endLabel}`],
    ['الساعات التدريبية المنجزة', `${data.completedHours != null ? data.completedHours : '—'} ساعة`],
    ['حالة الأهلية', data.eligibilityLabel || 'مؤهل'],
    ['تاريخ الإصدار', issueLabel],
    ['رقم الكتاب', data.letterNo || '—'],
  ]
    .map(([label, value]) => buildInfoRowHtml(label, value))
    .join('');
  const verification = data.verificationCode
    ? `<div class="verify">رمز التحقق: ${escapeHtml(data.verificationCode)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(LETTER_TITLE)}</title>
<style>
  ${fontCss}
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 210mm;
    height: 297mm;
    background: #fffdf8;
    color: #0b1f3a;
    font-family: ${fontStack};
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
  .header-rule { height: 1.15mm; background: #0b1f3a; margin: 2mm 0 0; }
  .header-gold { height: 0.45mm; background: #c5a057; margin: 1.1mm 0 5mm; }
  h1 {
    margin: 0 0 3mm;
    text-align: center;
    font-size: 22pt;
    font-weight: 700;
    color: #0b1f3a;
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
  ${INFO_SECTION_CSS}
  .sign-wrap { position: relative; min-height: 52mm; margin-top: 1mm; }
  .sign-text { position: absolute; top: 10mm; right: 4mm; text-align: center; z-index: 2; }
  .sign-role { font-size: 12.5pt; color: #3b4a63; margin-bottom: 1mm; }
  .sign-name { font-size: 16pt; font-weight: 700; color: #0b1f3a; }
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
    ${logo ? `<img class="logo" src="${logo}" alt="BATMAN TECHNOLOGY"/>` : ''}
    <div class="header-rule"></div>
    <div class="header-gold"></div>
    <h1>${escapeHtml(LETTER_TITLE)}</h1>
    <div class="meta">
      <span>تاريخ الإصدار: ${escapeHtml(issueLabel)}</span>
      <span>الرقم المرجعي: ${escapeHtml(data.letterNo || '—')}</span>
    </div>
    <div class="recipient">إلى من يهمه الأمر</div>
    <div class="body">${paragraphs}</div>
    <div class="info">${infoRows}</div>
    <div class="sign-wrap">
      <div class="sign-text">
        <div class="sign-role">${escapeHtml(SIGNATORY_TITLE)}</div>
        <div class="sign-name">${escapeHtml(SIGNATORY_NAME)}</div>
      </div>
      ${stamp ? `<img class="stamp" src="${stamp}" alt=""/>` : ''}
    </div>
    <div class="footer">
      شركة الرجل الوطواط للتكنولوجيا · المملكة الأردنية الهاشمية — عمّان · privacy@battechno.com
      ${verification}
    </div>
  </div>
</body>
</html>`;
}

function resetTemplateCachesForTests() {
  cachedFontCss = null;
  cachedLogoUri = null;
  cachedStampUri = null;
}

module.exports = {
  SIGNATORY_TITLE,
  SIGNATORY_NAME,
  LETTER_TITLE,
  FONT_FAMILY,
  MIN_COMPLETION_LETTER_HOURS,
  TEMPLATE_VERSION,
  escapeHtml,
  formatArDate,
  loadFontFaceCss,
  loadLogoDataUri,
  loadStampDataUri,
  computeLetterSourceHash,
  buildOfficialCompletionLetterHtml,
  buildInfoRowHtml,
  INFO_SECTION_CSS,
  resetTemplateCachesForTests,
};
