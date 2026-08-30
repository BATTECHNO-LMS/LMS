'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SIGNATORY_TITLE = 'مسؤول التدريب';
const SIGNATORY_NAME = 'عاصم القيسي';
const FONT_FAMILY = 'Sakkal Majalla';
const MIN_COMPLETION_LETTER_HOURS = 140;

const FONT_CANDIDATES = [
  process.env.SAKKAL_MAJALLA_FONT_PATH,
  'C:\\Windows\\Fonts\\majalla.ttf',
  'C:\\Windows\\Fonts\\SakkalMajalla.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/SakkalMajalla.ttf',
].filter(Boolean);

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

function loadFontFaceCss() {
  if (cachedFontCss != null) return cachedFontCss;
  for (const candidate of FONT_CANDIDATES) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const buf = fs.readFileSync(candidate);
      const b64 = buf.toString('base64');
      cachedFontCss = `@font-face { font-family: '${FONT_FAMILY}'; src: url('data:font/ttf;base64,${b64}') format('truetype'); font-weight: normal; font-style: normal; }`;
      return cachedFontCss;
    } catch {
      /* try next */
    }
  }
  cachedFontCss = '';
  return cachedFontCss;
}

function loadLogoDataUri() {
  if (cachedLogoUri != null) return cachedLogoUri;
  const file = path.join(__dirname, 'assets', 'battechno-logo.png');
  try {
    const buf = fs.readFileSync(file);
    cachedLogoUri = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    cachedLogoUri = '';
  }
  return cachedLogoUri;
}

function loadStampDataUri() {
  if (cachedStampUri != null) return cachedStampUri;
  const file = path.join(__dirname, 'assets', 'battechno-stamp.svg');
  try {
    const buf = fs.readFileSync(file);
    cachedStampUri = `data:image/svg+xml;base64,${buf.toString('base64')}`;
  } catch {
    cachedStampUri = '';
  }
  return cachedStampUri;
}

function computeLetterSourceHash(data) {
  const payload = [
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

function buildOfficialCompletionLetterHtml(data) {
  const fontCss = loadFontFaceCss();
  const logo = loadLogoDataUri();
  const stamp = loadStampDataUri();
  const fontStack = `'${FONT_FAMILY}', 'Traditional Arabic', Tahoma, Arial, sans-serif`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<style>
  ${fontCss}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${fontStack};
    color: #132D4A;
    background: #fff;
    direction: rtl;
    text-align: right;
    padding: 28px 36px;
  }
  .sheet { min-height: 980px; border: 2px solid #132D4A; padding: 28px 32px 36px; position: relative; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 3px solid #C9A227;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .logo { height: 78px; width: auto; }
  .brand { text-align: center; flex: 1; }
  .brand h1 { margin: 0 0 6px; font-size: 26px; color: #132D4A; }
  .brand .sub { font-size: 15px; color: #8B6914; }
  .letter-no { font-size: 13px; color: #5c6675; white-space: nowrap; }
  h2 { text-align: center; font-size: 22px; margin: 8px 0 22px; color: #132D4A; }
  .body { font-size: 18px; line-height: 2; }
  .body p { margin: 0 0 10px; }
  .meta { margin: 18px 0; }
  .meta-row { display: flex; gap: 8px; margin: 4px 0; }
  .meta-row dt { min-width: 150px; font-weight: 700; }
  .sign {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 48px;
    gap: 24px;
  }
  .signatory { text-align: center; min-width: 180px; }
  .signatory .title { font-size: 16px; font-weight: 700; }
  .signatory .name { font-size: 20px; margin-top: 8px; }
  .stamp { width: 130px; height: 130px; }
  .footer {
    margin-top: 36px;
    border-top: 1px solid #d6c9a8;
    padding-top: 10px;
    font-size: 12px;
    color: #5c6675;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      ${logo ? `<img class="logo" src="${logo}" alt="BATTECHNO"/>` : '<div class="logo"></div>'}
      <div class="brand">
        <h1>بات تكنو</h1>
        <div class="sub">BATTECHNO LMS</div>
      </div>
      <div class="letter-no">رقم الكتاب: ${escapeHtml(data.letterNo)}</div>
    </header>
    <h2>كتاب إنهاء التدريب الميداني</h2>
    <div class="body">
      <p>نشهد نحن شركة بات تكنو بأن الطالب/ة <strong>${escapeHtml(data.studentName)}</strong></p>
      <p>حامل/ة الرقم الجامعي <strong>${escapeHtml(data.universityNumber || '—')}</strong></p>
      <p>من جامعة <strong>${escapeHtml(data.universityName || '—')}</strong> — تخصص <strong>${escapeHtml(data.specialtyName || '—')}</strong></p>
      <p>قد أتم/أتمت التدريب الميداني في فرصة: <strong>${escapeHtml(data.opportunityTitle || '—')}</strong></p>
      <p>وذلك خلال الفترة من <strong>${escapeHtml(data.startDate || '—')}</strong> إلى <strong>${escapeHtml(data.endDate || '—')}</strong></p>
      <p>بعدد ساعات تدريبية مكتملة يبلغ <strong>${escapeHtml(data.completedHours != null ? String(data.completedHours) : '—')}</strong> ساعة.</p>
    </div>
    <dl class="meta">
      <div class="meta-row"><dt>نسبة الحضور</dt><dd>${data.attendancePct != null ? `${escapeHtml(String(data.attendancePct))}%` : '—'}</dd></div>
      <div class="meta-row"><dt>درجة التقييم البعدي</dt><dd>${data.postScore != null ? escapeHtml(String(data.postScore)) : '—'}</dd></div>
    </dl>
    <div class="sign">
      <div class="signatory">
        <div class="title">${SIGNATORY_TITLE}</div>
        <div class="name">${SIGNATORY_NAME}</div>
      </div>
      ${stamp ? `<img class="stamp" src="${stamp}" alt="الختم الرسمي"/>` : ''}
    </div>
    <div class="footer">
      رمز التحقق: ${escapeHtml(data.verificationCode || '—')} · تاريخ الإصدار: ${escapeHtml(data.issuedAt || '—')}
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
  FONT_FAMILY,
  MIN_COMPLETION_LETTER_HOURS,
  escapeHtml,
  loadFontFaceCss,
  loadLogoDataUri,
  loadStampDataUri,
  computeLetterSourceHash,
  buildOfficialCompletionLetterHtml,
  resetTemplateCachesForTests,
};
