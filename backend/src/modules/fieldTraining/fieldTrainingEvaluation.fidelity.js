'use strict';

const crypto = require('crypto');
const JSZip = require('jszip');
const pdfParse = require('pdf-parse');
const { ApiError } = require('../../utils/apiError');
const {
  PDF_RENDER_FAILED_CODE,
  TEMPLATE_FIDELITY_FAIL,
} = require('./fieldTrainingEvaluation.constants');
const {
  cellPlainText,
  countScoreGridCheckmarks,
  normalizeDocumentScoreGridTables,
} = require('./fieldTrainingEvaluation.formFill');

const GENERIC_REPORT_MARKERS = Object.freeze([
  'BATTECHNO LMS',
  'هذا التقرير للاستخدام الإداري الداخلي',
  'ھذا التقرير للاستخدام الإداري الداخلي',
  'Internal administrative use only',
]);

const MUTAH_STATIC_MARKERS = Object.freeze([
  'Faculty of Information Technology',
  'Practical Training Evaluation Form',
  'تقييم طلبة التدريب الميداني',
]);

const UNCHANGED_PART_PATTERNS = Object.freeze([
  /^word\/styles(?:WithEffects)?\.xml$/i,
  /^word\/settings\.xml$/i,
  /^word\/fontTable\.xml$/i,
  /^word\/numbering\.xml$/i,
  /^word\/theme\/.+\.xml$/i,
  /^word\/header\d+\.xml$/i,
  /^word\/footer\d+\.xml$/i,
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function occurrences(haystack, needle) {
  const source = normalizedText(haystack);
  const wanted = normalizedText(needle);
  if (!wanted) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= source.length) {
    const hit = source.indexOf(wanted, offset);
    if (hit < 0) break;
    count += 1;
    offset = hit + wanted.length;
  }
  return count;
}

function tableGeometrySignature(xml) {
  const tables = [...String(xml || '').matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  const geometry = tables.map((table) => {
    const tableProperties = (table.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/) || [''])[0];
    const tableGrid = (table.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/) || [''])[0];
    const rows = [...table.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((match) => match[0]);
    return {
      tableProperties,
      tableGrid,
      rows: rows.map((row) => ({
        rowProperties: (row.match(/<w:trPr>[\s\S]*?<\/w:trPr>/) || [''])[0],
        cells: [...row.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map(
          (cell) => (cell[0].match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0]
        ),
      })),
    };
  });
  return sha256(JSON.stringify(geometry));
}

function pageGeometrySignature(xml) {
  const sections = [...String(xml || '').matchAll(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g)].map(
    (match) => match[0]
  );
  return sha256(JSON.stringify(sections));
}

async function readZipParts(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const parts = new Map();
  await Promise.all(
    names.map(async (name) => {
      parts.set(name, await zip.file(name).async('nodebuffer'));
    })
  );
  return { zip, names, parts };
}

async function docxFingerprint(buffer) {
  const { names, parts } = await readZipParts(buffer);
  const rawDocumentXml = String(parts.get('word/document.xml') || '');
  const documentXml = normalizeDocumentScoreGridTables(rawDocumentXml);
  const mediaNames = names.filter((name) => /^word\/media\//i.test(name)).sort();
  const staticParts = names.filter((name) =>
    UNCHANGED_PART_PATTERNS.some((pattern) => pattern.test(name))
  );
  return {
    documentXml,
    text: cellPlainText(documentXml),
    tableGeometry: tableGeometrySignature(documentXml),
    pageGeometry: pageGeometrySignature(documentXml),
    media: Object.fromEntries(mediaNames.map((name) => [name, sha256(parts.get(name))])),
    staticParts: Object.fromEntries(staticParts.map((name) => [name, sha256(parts.get(name))])),
    sourceHash: sha256(buffer),
  };
}

function dynamicTextIssues(filled, payload) {
  const issues = [];
  const cellTexts = [...filled.documentXml.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map(
    (match) => normalizedText(cellPlainText(match[0]))
  );
  const rowTexts = [...filled.documentXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map(
    (match) => normalizedText(cellPlainText(match[0]))
  );
  const fields = [
    ['student_name', /اسم الطالب/, payload.student_name],
    ['student_number', /الرقم/, payload.student_number],
    ['student_specialty', /التخصص/, payload.student_specialty],
    ['semester', /الفصل الدراسي/, payload.semester],
    ['academic_year', /السنة الدراسية/, payload.academic_year],
    ['training_days', /عدد الأيام التي تدربها الطالب/, payload.training_days],
    ['training_hours_display', /عدد الساعات/, payload.training_hours_display],
    ['absence_days', /عدد الأيام التي تغيب/, payload.absence_days],
    ['organization_name', /اسم الشركة أو المؤسسة/, payload.organization_name],
    ['organization_department', /الفرع أو القسم/, payload.organization_department],
    ['organization_email', /البريد الإلكتروني/, payload.organization_email],
    ['organization_phone', /الهاتف/, payload.organization_phone],
    ['organization_fax', /الفاكس/, payload.organization_fax],
    ['organization_address', /العنوان/, payload.organization_address],
    ['field_supervisor_name', /اسم المشرف الميداني/, payload.field_supervisor_name],
    ['responsible_person_name', /اسم المسؤول/, payload.responsible_person_name],
  ];
  for (const [field, label, raw] of fields) {
    if (raw == null || raw === '') continue;
    const value = normalizedText(raw);
    if (!cellTexts.some((text) => label.test(text) && text.includes(value))) {
      issues.push({ code: 'DYNAMIC_FIELD_NOT_RENDERED_IN_EXPECTED_CELL', field, value: raw });
    }
  }

  if (
    payload.training_start_date &&
    payload.training_end_date &&
    !rowTexts.some(
      (text) =>
        /فترة التدريب/.test(text) &&
        text.includes(normalizedText(payload.training_start_date)) &&
        text.includes(normalizedText(payload.training_end_date))
    )
  ) {
    issues.push({ code: 'TRAINING_PERIOD_NOT_RENDERED_IN_EXPECTED_ROW' });
  }

  const fieldDate = normalizedText(payload.field_supervisor_date);
  const academicDate = normalizedText(payload.academic_supervisor_date);
  if (fieldDate && academicDate) {
    const signatureDateCells = cellTexts.filter((text) => /التاريخ/.test(text));
    if (
      !signatureDateCells.some((text) => text.includes(fieldDate)) ||
      !signatureDateCells.some((text) => text.includes(academicDate)) ||
      (fieldDate === academicDate &&
        signatureDateCells.filter((text) => text.includes(fieldDate)).length < 2)
    ) {
      issues.push({ code: 'SIGNATURE_DATES_NOT_RENDERED_IN_EXPECTED_CELLS' });
    }
  }

  const total = payload.professional_evaluation_total;
  if (
    total != null &&
    total !== '' &&
    !cellTexts.some(
      (text) => /المجموع/.test(text) && text.includes(String(Number(total)))
    )
  ) {
    issues.push({ code: 'PROFESSIONAL_TOTAL_NOT_RENDERED', field: 'professional_evaluation_total' });
  }
  if (countScoreGridCheckmarks(filled.documentXml) !== 10) {
    issues.push({
      code: 'CHECKMARK_COUNT_INVALID',
      expected: 10,
      actual: countScoreGridCheckmarks(filled.documentXml),
    });
  }
  if (payload.general_comments && occurrences(filled.text, payload.general_comments) !== 1) {
    issues.push({
      code: 'COMMENTS_RENDER_COUNT_INVALID',
      expected: 1,
      actual: occurrences(filled.text, payload.general_comments),
    });
  }
  return issues;
}

function throwFidelityFailure(issues, details = {}) {
  throw new ApiError(
    422,
    'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
    { issues, ...details },
    TEMPLATE_FIDELITY_FAIL
  );
}

async function verifyFilledDocxFidelity({ templateBuffer, filledBuffer, payload = {} }) {
  const [source, filled] = await Promise.all([
    docxFingerprint(templateBuffer),
    docxFingerprint(filledBuffer),
  ]);
  const issues = [];

  if (source.tableGeometry !== filled.tableGeometry) {
    issues.push({ code: 'DOCX_TABLE_GEOMETRY_CHANGED' });
  }
  if (source.pageGeometry !== filled.pageGeometry) {
    issues.push({ code: 'DOCX_PAGE_GEOMETRY_CHANGED' });
  }
  if (JSON.stringify(source.media) !== JSON.stringify(filled.media)) {
    issues.push({ code: 'DOCX_EMBEDDED_MEDIA_CHANGED' });
  }
  if (JSON.stringify(source.staticParts) !== JSON.stringify(filled.staticParts)) {
    issues.push({ code: 'DOCX_STATIC_FORMATTING_PART_CHANGED' });
  }

  for (const marker of MUTAH_STATIC_MARKERS) {
    if (source.text.includes(marker) && !filled.text.includes(marker)) {
      issues.push({ code: 'OFFICIAL_STATIC_HEADER_REMOVED', marker });
    }
  }
  for (const marker of GENERIC_REPORT_MARKERS) {
    if (!source.text.includes(marker) && filled.text.includes(marker)) {
      issues.push({ code: 'UNAUTHORIZED_GENERIC_BRANDING_ADDED', marker });
    }
  }
  issues.push(...dynamicTextIssues(filled, payload));

  if (issues.length) {
    throwFidelityFailure(issues, {
      sourceTemplateSha256: source.sourceHash,
      filledDocxSha256: filled.sourceHash,
    });
  }
  return {
    ok: true,
    sourceTemplateSha256: source.sourceHash,
    filledDocxSha256: filled.sourceHash,
    mediaPreserved: true,
    tableGeometryPreserved: true,
    pageGeometryPreserved: true,
  };
}

async function verifyOfficialEvaluationPdf(pdfBuffer, { expectedPageCount = 2 } = {}) {
  let parsed;
  try {
    parsed = await pdfParse(pdfBuffer);
  } catch (err) {
    throw new ApiError(
      500,
      'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
      { reason: err?.message || 'pdf_validation_failed' },
      PDF_RENDER_FAILED_CODE
    );
  }

  const issues = [];
  if (expectedPageCount != null && parsed.numpages !== expectedPageCount) {
    issues.push({
      code: 'PDF_PAGE_COUNT_MISMATCH',
      expected: expectedPageCount,
      actual: parsed.numpages,
    });
  }
  for (const marker of GENERIC_REPORT_MARKERS) {
    if (String(parsed.text || '').includes(marker)) {
      issues.push({ code: 'UNAUTHORIZED_GENERIC_BRANDING_IN_PDF', marker });
    }
  }
  if (issues.length) {
    throwFidelityFailure(issues, { generatedPageCount: parsed.numpages });
  }
  return { ok: true, pageCount: parsed.numpages, text: parsed.text || '' };
}

module.exports = {
  GENERIC_REPORT_MARKERS,
  MUTAH_STATIC_MARKERS,
  docxFingerprint,
  verifyFilledDocxFidelity,
  verifyOfficialEvaluationPdf,
};
