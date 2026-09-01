'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const JSZip = require('jszip');
const { TEMPLATE_FONT_UNAVAILABLE } = require('./fieldTrainingEvaluation.constants');
const { detectUniversityLabelForm, cellPlainText, normalizeAr } = require('./fieldTrainingEvaluation.formFill');

const WINDOWS_FONT_DIR = 'C:\\Windows\\Fonts';
const LINUX_FONT_DIRS = ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts')];

const FONT_FILE_HINTS = Object.freeze({
  'Simplified Arabic': ['simpo.ttf', 'simpbdo.ttf', 'simplified arabic', 'trado.ttf'],
  'Times New Roman': ['times.ttf', 'timesnr', 'times new roman'],
  'Traditional Arabic': ['trado.ttf', 'tradbdo.ttf', 'traditional arabic'],
  Andalus: ['andlso.ttf', 'andalus'],
  Arial: ['arial.ttf', 'arial'],
  Calibri: ['calibri.ttf', 'calibri'],
  'Calibri Light': ['calibril.ttf', 'calibri light'],
  Symbol: ['symbol.ttf', 'symbol'],
  SimSun: ['simsun.ttc', 'simsun'],
});

function parseUsedFonts(xml) {
  const names = new Set();
  const source = String(xml || '');
  for (const tag of source.matchAll(/<w:rFonts\b[^>]*>/g)) {
    for (const match of tag[0].matchAll(/w:(?:ascii|hAnsi|cs|eastAsia)="([^"]+)"/g)) {
      const name = String(match[1] || '').trim();
      if (name && name !== 'none') names.add(name);
    }
  }
  for (const match of source.matchAll(/<a:(?:latin|ea|cs)\b[^>]*typeface="([^"]+)"/g)) {
    const name = String(match[1] || '').trim();
    if (name && !name.startsWith('+')) names.add(name);
  }
  return [...names];
}

function configuredAvailableFonts() {
  const raw = String(process.env.FT_EVAL_AVAILABLE_FONTS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return new Set(raw);
}

function fontDirs() {
  if (process.platform === 'win32') return [WINDOWS_FONT_DIR];
  return LINUX_FONT_DIRS.filter((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

function listInstalledFontFiles() {
  const files = [];
  const pending = [...fontDirs()];
  while (pending.length) {
    const dir = pending.pop();
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) pending.push(path.join(dir, entry.name));
        else files.push(entry.name.toLowerCase());
      }
    } catch {
      /* skip unreadable font dirs */
    }
  }
  return files;
}

function fontLooksInstalled(fontName, installedFiles, allowedFallbacks) {
  const name = String(fontName || '').trim();
  if (!name) return true;
  if (allowedFallbacks.has(name)) return true;
  const hints = FONT_FILE_HINTS[name] || [name.toLowerCase()];
  const hay = installedFiles.join(' ');
  return hints.some((hint) => hay.includes(String(hint).toLowerCase()));
}

function collectDocumentXml(parts) {
  const document = parts.find((part) => part.path === 'word/document.xml');
  return document?.xml || '';
}

async function inspectTemplateBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    return {
      ok: false,
      readable: false,
      code: 'TEMPLATE_UNREADABLE',
      messageAr: 'تعذر قراءة ملف قالب التقييم.',
    };
  }
  const xml = await documentFile.async('string');
  const xmlPartNames = Object.keys(zip.files).filter(
    (name) => /^word\/.+\.xml$/i.test(name) && !zip.files[name].dir
  );
  const xmlParts = await Promise.all(
    xmlPartNames.map(async (name) => ({ path: name, xml: await zip.file(name).async('string') }))
  );
  const allWordXml = xmlParts.map((part) => part.xml).join('\n');
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  const text = normalizeAr(cellPlainText(xml));
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const scoreTable = tables.find((table) => {
    const rows = [...table.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
    const header = cellPlainText(rows[0]?.[0] || '');
    return rows.length >= 11 && /مجال التقييم/.test(header) && /(ممتاز|جيد)/.test(header);
  });
  const scoreRows = scoreTable ? [...scoreTable.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].length : 0;
  const hasCommentsHeading = /ملاحظات عامه|ملاحظات عامة/.test(text);
  const emptyCommentsTable = tables.some((table) => !cellPlainText(table));
  const hasResponsible = /اسم المسؤول/.test(text);
  const hasFieldSupervisor = /اسم المشرف/.test(text);
  const hasStampLabel = /الختم الرسمي/.test(text);
  const hasSignatureLabel = /التوقيع/.test(text);
  const fonts = parseUsedFonts(allWordXml);
  const mutahOfficial =
    Boolean(detectUniversityLabelForm(xml)) &&
    media.length > 0 &&
    /تقييم طلبه التدريب الميداني/.test(normalizeAr(cellPlainText(allWordXml)));
  return {
    ok: true,
    readable: true,
    labelForm: detectUniversityLabelForm(xml),
    mediaCount: media.length,
    hasMedia: media.length > 0,
    hasOfficialStampLabel: hasStampLabel,
    hasSignatureLabel,
    hasResponsibleField: hasResponsible,
    hasFieldSupervisorField: hasFieldSupervisor,
    hasCommentsSection: hasCommentsHeading || emptyCommentsTable,
    evaluationGridRows: scoreRows,
    evaluationGridRecognized: Boolean(scoreTable && scoreRows >= 11),
    fonts,
    mutahOfficial,
    expectedPageCount: mutahOfficial || detectUniversityLabelForm(xml) ? 2 : null,
    media,
    zip,
    xml,
  };
}

function blockingIssues(inspection, { requireStamp = false, requireSignature = false } = {}) {
  const issues = [];
  if (!inspection.readable) {
    issues.push({
      code: 'TEMPLATE_UNREADABLE',
      messageAr: 'تعذر قراءة ملف قالب التقييم.',
    });
    return issues;
  }
  if (!inspection.labelForm && !inspection.evaluationGridRecognized) {
    issues.push({
      code: 'TEMPLATE_STRUCTURE_UNRECOGNIZED',
      messageAr: 'تعذر التعرف على بنية صفحات نموذج تقييم التدريب الميداني داخل القالب.',
    });
  }
  if (!inspection.evaluationGridRecognized) {
    issues.push({
      code: 'EVALUATION_GRID_UNRECOGNIZED',
      messageAr: 'تعذر التعرف على جدول التقييم داخل القالب.',
    });
  }
  if (!inspection.hasCommentsSection) {
    issues.push({
      code: 'COMMENTS_SECTION_MISSING',
      messageAr: 'تعذر التعرف على خانة الملاحظات العامة داخل القالب.',
    });
  }
  if (!inspection.hasResponsibleField) {
    issues.push({
      code: 'RESPONSIBLE_FIELD_MISSING',
      messageAr: 'تعذر التعرف على خانة اسم المسؤول داخل القالب.',
    });
  }
  if (!inspection.hasFieldSupervisorField) {
    issues.push({
      code: 'FIELD_SUPERVISOR_FIELD_MISSING',
      messageAr: 'تعذر التعرف على خانة اسم المشرف الميداني داخل القالب.',
    });
  }
  if (requireStamp && inspection.hasOfficialStampLabel && !inspection.hasMedia) {
    issues.push({
      code: 'STAMP_MISSING',
      messageAr: 'القالب لا يحتوي على الختم/التوقيع المطلوب.',
    });
  }
  if (requireSignature && inspection.hasSignatureLabel && !inspection.hasMedia) {
    issues.push({
      code: 'SIGNATURE_MISSING',
      messageAr: 'القالب لا يحتوي على الختم/التوقيع المطلوب.',
    });
  }
  return issues;
}

function fontIssues(inspection) {
  const installed = listInstalledFontFiles();
  const allowed = configuredAvailableFonts();
  const missing = (inspection.fonts || []).filter((font) => !fontLooksInstalled(font, installed, allowed));
  if (!missing.length) return [];
  return missing.map((font) => ({
    code: TEMPLATE_FONT_UNAVAILABLE,
    font,
    messageAr: `لا يمكن إصدار التقارير لأن الخط المستخدم في القالب غير متوفر على خادم إنشاء التقارير:\n${font}`,
  }));
}

async function preflightEvaluationTemplate(buffer, options = {}) {
  try {
    const inspection = await inspectTemplateBuffer(buffer);
    const issues = [...blockingIssues(inspection, options), ...fontIssues(inspection)];
    return {
      ok: issues.length === 0,
      issues,
      inspection: {
        readable: inspection.readable,
        labelForm: inspection.labelForm,
        mediaCount: inspection.mediaCount,
        hasOfficialStampLabel: inspection.hasOfficialStampLabel,
        hasSignatureLabel: inspection.hasSignatureLabel,
        hasResponsibleField: inspection.hasResponsibleField,
        hasFieldSupervisorField: inspection.hasFieldSupervisorField,
        hasCommentsSection: inspection.hasCommentsSection,
        evaluationGridRecognized: inspection.evaluationGridRecognized,
        fonts: inspection.fonts,
        mutahOfficial: inspection.mutahOfficial,
        expectedPageCount: inspection.expectedPageCount,
      },
    };
  } catch {
    return {
      ok: false,
      issues: [{ code: 'TEMPLATE_UNREADABLE', messageAr: 'تعذر قراءة ملف قالب التقييم.' }],
      inspection: { readable: false },
    };
  }
}

module.exports = {
  parseUsedFonts,
  inspectTemplateBuffer,
  preflightEvaluationTemplate,
  collectDocumentXml,
};
