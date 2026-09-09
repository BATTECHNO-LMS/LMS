'use strict';

const { CHECKMARK } = require('./fieldTrainingEvaluation.constants');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cellPlainText(xml) {
  return String(xml || '')
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<w:br[^/]*\/>/g, ' ')
    .replace(/<\/w:p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAr(value) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

function detectUniversityLabelForm(xml) {
  const text = normalizeAr(cellPlainText(xml));
  return text.includes('اسم الطالب') && (text.includes('مجال التقييم') || text.includes('الكفاءه في') || text.includes('الكفاءة في'));
}

function cellHasDrawing(xml) {
  return /<w:drawing|<w:pict|<v:imagedata|<w:object/.test(String(xml || ''));
}

function setParagraphText(pXml, text) {
  const open = pXml.match(/^<w:p\b[^>]*>/);
  if (!open) return pXml;
  const pPr = (pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
  const rPr = (pXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  const drawings = [...pXml.matchAll(/<w:drawing[\s\S]*?<\/w:drawing>|<w:pict[\s\S]*?<\/w:pict>|<w:r\b[^>]*>[\s\S]*?<v:imagedata[\s\S]*?<\/w:r>/g)]
    .map((m) => m[0])
    .join('');
  const lines = String(text ?? '').split(/\r?\n/);
  const runs = lines
    .map(
      (line, index) =>
        `<w:r>${rPr}${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    )
    .join('');
  return `${open[0]}${pPr}${runs}${drawings}</w:p>`;
}

function replaceFirstParagraph(cellXml, text) {
  if (!String(cellXml).includes('<w:p')) return cellXml;
  return cellXml.replace(/<w:p\b[\s\S]*?<\/w:p>/, (p) => setParagraphText(p, text));
}

function replaceTextRunsContaining(cellXml, matcher, nextText) {
  let replaced = false;
  const out = String(cellXml).replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, (run) => {
    const inner = run.replace(/<[^>]+>/g, '');
    if (!matcher(inner)) return run;
    replaced = true;
    return run.replace(/>[\s\S]*</, `>${escapeXml(nextText)}<`);
  });
  return replaced ? out : cellXml;
}

function blank(value) {
  if (value == null || value === '') return '';
  const text = String(value);
  if (text === 'undefined' || text === 'null') return '';
  return text;
}

function criterionScore(values, index) {
  const raw =
    values[`criterion_${index}_score`] ??
    values.criteria?.[`criterion${index}`] ??
    values.criteria?.[`criterion_${index}_score`];
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function scoreGridHeaderCells(tableXml) {
  const rows = [...tableXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
  if (!rows.length) return [];
  return [...rows[0][0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((cell) => cellPlainText(cell[0]));
}

function isScoreGridTable(tableXml) {
  const text = cellPlainText(tableXml);
  return /مجال التقييم/.test(text) && /(ممتاز|جيد)/.test(text);
}

function countBidiVisual(tableXml) {
  return (String(tableXml || '').match(/<w:bidiVisual\s*\/>/g) || []).length;
}

function scoreGridIsLogicalRtl(tableXml) {
  const headers = scoreGridHeaderCells(tableXml).map((text) => normalizeAr(text));
  return /الرقم/.test(headers[0] || '') && /(?:ف|ض)عيف\s*1/.test(headers[headers.length - 1] || '');
}

function scoreGridIsVisualLtr(tableXml) {
  const headers = scoreGridHeaderCells(tableXml).map((text) => normalizeAr(text));
  return /(?:ف|ض)عيف\s*1/.test(headers[0] || '') && /الرقم/.test(headers[headers.length - 1] || '');
}

/**
 * V11 already stores the evaluation grid in visual-LTR XML:
 * ضعيف 1 … ممتاز 5 | مجال التقييم | الرقم
 * Word paints that as الرقم on the visual right. Do not add w:bidiVisual,
 * do not strip floating-table properties, and do not reverse cells.
 */
function ensureScoreGridRtl(tableXml) {
  return tableXml;
}

function ensureBidiVisual(tableXml) {
  return tableXml;
}

function assertDesiredScoreGridHeaderOrder(headerCells = []) {
  const normalized = headerCells.map((text) => normalizeAr(text));
  if (normalized.length < 7) return false;
  return (
    /(?:ف|ض)عيف\s*1/.test(normalized[0] || '') &&
    /متوسط\s*2/.test(normalized[1] || '') &&
    /جيد\s*3/.test(normalized[2] || '') &&
    /جيد\s*جدا\s*4/.test(normalized[3] || '') &&
    /ممتاز\s*5/.test(normalized[4] || '') &&
    /مجال التقييم/.test(normalized[normalized.length - 2] || '') &&
    /الرقم/.test(normalized[normalized.length - 1] || '')
  );
}

function stripScoreGridFloat(tableXml) {
  return String(tableXml || '');
}

function normalizeDocumentScoreGridTables(xml) {
  return String(xml || '');
}

function ratingColumnIndexForScore(headerCells, score) {
  const patterns = {
    5: /ممتاز\s*5/,
    4: /جيد\s*جدا\s*4/,
    3: /جيد\s*3/,
    2: /متوسط\s*2/,
    1: /(?:ف|ض)عيف\s*1/,
  };
  const pattern = patterns[score];
  if (!pattern) return -1;
  return headerCells.findIndex((text) => pattern.test(normalizeAr(text)));
}

function insertCheckmarkInCell(cellXml) {
  const withText = String(cellXml).replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/, (run) =>
    run.replace(/>[\s\S]*</, `>${CHECKMARK}<`)
  );
  if (withText !== String(cellXml)) return withText;
  return replaceFirstParagraph(cellXml, CHECKMARK);
}

function fillScoreGridTable(tableXml, values) {
  const rows = [...tableXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
  if (rows.length < 11) return tableXml;
  const headerCells = scoreGridHeaderCells(tableXml);
  const header = headerCells.join(' ');
  if (!/مجال التقييم/.test(header) || !/(ممتاز|جيد)/.test(header)) return tableXml;

  const hasScores = Array.from({ length: 10 }, (_, index) => criterionScore(values, index + 1)).some(
    (score) => score != null
  );
  const hasTotal = blank(values.professional_evaluation_total) !== '';
  if (!hasScores && !hasTotal) return tableXml;

  let out = tableXml;
  for (let i = 1; i <= 10; i += 1) {
    const rowXml = rows[i]?.[0];
    if (!rowXml) continue;
    const score = criterionScore(values, i);
    const cells = [...rowXml.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    const colIndex = score != null ? ratingColumnIndexForScore(headerCells, score) : -1;
    if (colIndex < 0 || !cells[colIndex]) continue;
    const filledCell = insertCheckmarkInCell(cells[colIndex][0]);
    out = out.replace(rowXml, rowXml.replace(cells[colIndex][0], filledCell));
  }

  const total = blank(values.professional_evaluation_total);
  if (total !== '') {
    const last = rows[rows.length - 1]?.[0];
    if (last && /المجموع/.test(cellPlainText(last))) {
      const cells = [...last.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const totalCell = cells.find((c) => /المجموع/.test(cellPlainText(c[0]))) || cells[cells.length - 1];
      if (totalCell) {
        const replaced = replaceTextRunsContaining(
          totalCell[0],
          (inner) => /المجموع/.test(inner),
          `المجموع: ${total}`
        );
        out = out.replace(totalCell[0], replaced === totalCell[0] ? replaceFirstParagraph(totalCell[0], `المجموع: ${total}`) : replaced);
      }
    }
  }
  return out;
}

function countScoreGridCheckmarks(xml) {
  const tables = [...String(xml || '').matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  let count = 0;
  for (const table of tables) {
    const rtlTable = ensureScoreGridRtl(table);
    const rows = [...rtlTable.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
    if (rows.length < 11) continue;
    const header = scoreGridHeaderCells(rtlTable).join(' ');
    if (!/مجال التقييم/.test(header) || !/(ممتاز|جيد)/.test(header)) continue;
    for (let i = 1; i <= 10; i += 1) {
      const cells = [...(rows[i]?.[0] || '').matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const marks = cells.filter((c) => cellPlainText(c[0]).includes(CHECKMARK)).length;
      count += marks;
    }
  }
  return count;
}

function matchLabelKey(text) {
  const t = normalizeAr(text);
  if (!t) return null;
  if (/اسم الطالب/.test(t)) return { key: 'student_name', label: 'اسم الطالب:' };
  if (/^الرقم\s*:/.test(t) && !/مجال/.test(t)) return { key: 'student_number', label: 'الرقم:' };
  if (/التخصص/.test(t)) return { key: 'student_specialty', label: 'التخصص:' };
  if (/الفصل الدراسي/.test(t)) return { key: 'semester', label: 'الفصل الدراسي:' };
  if (/السنه الدراسيه|السنة الدراسية/.test(t)) return { key: 'academic_year', label: 'السنة الدراسية:' };
  if (/فتره التدر|فترة التدر/.test(t)) return { key: 'period', label: null };
  if (/عدد الايام التي تدربها|عدد الأيام التي تدربها/.test(t) && !/تغيب/.test(t)) {
    return { key: 'training_days', label: 'عدد الأيام التي تدربها الطالب:' };
  }
  if (/عدد الساعات اليوميه|عدد الساعات اليومية/.test(t)) {
    return { key: 'training_hours_display', label: 'عدد الساعات اليومية (الفعلية) التي تدربها الطالب:' };
  }
  if (/تغيب/.test(t)) return { key: 'absence_days', label: 'عدد الأيام التي تغيب فيها الطالب عن التدريب:' };
  if (/اسم الشركه|اسم الشركة/.test(t)) return { key: 'organization_name', label: 'اسم الشركة أو المؤسسة:' };
  if (/الفرع او القسم|الفرع أو القسم/.test(t)) return { key: 'organization_department', label: 'الفرع أو القسم:' };
  if (/البريد/.test(t)) return { key: 'organization_email', label: 'البريد الإلكتروني:' };
  if (/الهاتف/.test(t)) return { key: 'organization_phone', label: 'الهاتف:' };
  if (/الفاكس/.test(t)) return { key: 'organization_fax', label: 'الفاكس:' };
  if (/العنوان/.test(t)) return { key: 'organization_address', label: 'العنوان:' };
  if (/اسم المشرف/.test(t)) return { key: 'field_supervisor_name', label: 'اسم المشرف الميداني:' };
  if (/اسم المسؤول/.test(t)) return { key: 'responsible_person_name', label: 'اسم المسؤول:' };
  return null;
}

function composeLabeledText(label, value) {
  const raw = blank(value).replace(/\s+/g, ' ').trim();
  if (!label) return raw;
  const core = String(label).replace(/[:：]\s*$/, '').trim();
  const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = raw.replace(new RegExp(`^${escaped}\\s*[:：]?\\s*`), '').trim();
  return `${label} ${stripped}`.replace(/\s+/g, ' ').trim();
}

function fillLabeledCell(cellXml, values) {
  const text = cellPlainText(cellXml);
  const match = matchLabelKey(text);
  if (!match) return cellXml;
  if (match.key === 'period') {
    const start = blank(values.training_start_date);
    const end = blank(values.training_end_date);
    if (!start && !end) return cellXml;
    const filled = `فترة التدريب: ${start} إلى: ${end}`.trim();
    return replaceFirstParagraph(cellXml, filled);
  }
  const value =
    match.key === 'training_hours_display'
      ? blank(values.training_hours_display !== '' && values.training_hours_display != null
          ? values.training_hours_display
          : values.actual_training_hours)
      : blank(values[match.key]);
  if (value === '') return cellXml;
  const filled = composeLabeledText(match.label, value);
  return replaceFirstParagraph(stripMergeFieldMarkup(cellXml), filled);
}

function stripMergeFieldMarkup(xml) {
  return String(xml)
    .replace(/<w:fldChar\b[^/]*\/>/g, '')
    .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '');
}

function fillDateInCell(cellXml, dateValue) {
  const value = blank(dateValue);
  if (!value) return cellXml;
  let sawDate = false;
  const stripped = stripMergeFieldMarkup(cellXml);
  const out = String(stripped).replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, (run) => {
    const inner = run.replace(/<[^>]+>/g, '');
    if (/التاريخ/.test(inner)) {
      sawDate = true;
      return run.replace(/>[\s\S]*</, `>التاريخ : ${value}<`);
    }
    if (sawDate && /^\s*\d{4}\s*$/.test(inner)) {
      return run.replace(/>[\s\S]*</, '><');
    }
    return run;
  });
  if (sawDate) return out;
  if (cellHasDrawing(cellXml)) return cellXml;
  return replaceFirstParagraph(cellXml, `التاريخ : ${value}`);
}

function fillSignatureTable(tableXml, values) {
  const text = cellPlainText(tableXml);
  if (!/اسم المشرف/.test(text) || !/اسم المسؤول/.test(text)) return tableXml;
  const rows = [...tableXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
  if (!rows.length) return tableXml;
  let out = tableXml;
  const nameRow = rows[0]?.[0];
  if (nameRow) {
    const cells = [...nameRow.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    let filledRow = nameRow;
    if (cells[0]) {
      const filled = fillLabeledCell(cells[0][0], values);
      filledRow = filledRow.replace(cells[0][0], filled);
    }
    if (cells[1]) {
      const filled = fillLabeledCell(cells[1][0], values);
      filledRow = filledRow.replace(cells[1][0], filled);
    }
    out = out.replace(nameRow, filledRow);
  }
  const dateRow = rows[1]?.[0];
  if (dateRow) {
    const cells = [...dateRow.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    let filledRow = dateRow;
    if (cells[0]) {
      filledRow = filledRow.replace(
        cells[0][0],
        fillDateInCell(cells[0][0], values.field_supervisor_date || values.evaluation_date)
      );
    }
    if (cells[1]) {
      filledRow = filledRow.replace(
        cells[1][0],
        fillDateInCell(cells[1][0], values.academic_supervisor_date || values.evaluation_date)
      );
    }
    out = out.replace(dateRow, filledRow);
  }
  return out;
}

function fillCommentsTable(tableXml, comments) {
  const text = cellPlainText(tableXml);
  if (text) return tableXml;
  if (!comments) return tableXml;
  const lines = String(comments).split(/\r?\n/);
  const paras = [...tableXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
  if (!paras.length) return tableXml;
  const assigned = paras.map((_, i) => {
    const last = i === paras.length - 1;
    if (last) return lines.slice(i).join('\n');
    return i < lines.length ? lines[i] : null;
  });
  let lastUsed = 0;
  assigned.forEach((chunk, i) => {
    if (chunk != null && String(chunk).trim() !== '') lastUsed = i;
  });
  const keep = assigned.slice(0, lastUsed + 1);
  let index = 0;
  return tableXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (p) => {
    if (index >= keep.length) return '';
    const chunk = keep[index];
    index += 1;
    if (chunk == null || chunk === '') return p;
    return setParagraphText(p, chunk).replace(/<w:spacing w:before="120"\s*\/>/g, '<w:spacing w:before="0"/>');
  });
}

function fillUniversityLabelForm(xml, values = {}) {
  if (!detectUniversityLabelForm(xml)) return xml;
  let out = xml;
  const tables = [...out.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  for (const table of tables) {
    let next = fillSignatureTable(table, values);
    next = fillScoreGridTable(next, values);
    const header = cellPlainText(next === table ? table : next);
    if (!header && blank(values.general_comments)) {
      next = fillCommentsTable(next, blank(values.general_comments));
    }
    const cells = [...next.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    for (const cell of cells) {
      const filled = fillLabeledCell(cell[0], values);
      if (filled !== cell[0]) next = next.replace(cell[0], filled);
    }
    if (next !== table) out = out.replace(table, next);
  }
  return normalizeDocumentScoreGridTables(out);
}

function leftoverPlaceholders(xml) {
  const source = String(xml || '');
  const mustache = source.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) || [];
  const merge = /MERGEFIELD/i.test(source) ? ['MERGEFIELD'] : [];
  return [...new Set([...mustache, ...merge])];
}

module.exports = {
  detectUniversityLabelForm,
  fillUniversityLabelForm,
  fillScoreGridTable,
  cellPlainText,
  normalizeAr,
  matchLabelKey,
  countScoreGridCheckmarks,
  normalizeDocumentScoreGridTables,
  ensureScoreGridRtl,
  ensureBidiVisual,
  stripScoreGridFloat,
  scoreGridIsLogicalRtl,
  scoreGridIsVisualLtr,
  assertDesiredScoreGridHeaderOrder,
  ratingColumnIndexForScore,
  scoreGridHeaderCells,
  countBidiVisual,
  leftoverPlaceholders,
};
