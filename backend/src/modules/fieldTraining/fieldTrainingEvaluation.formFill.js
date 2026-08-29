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
  const rPr = (pPr.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || ['<w:rPr><w:rtl/></w:rPr>'])[0];
  const drawings = [...pXml.matchAll(/<w:drawing[\s\S]*?<\/w:drawing>|<w:pict[\s\S]*?<\/w:pict>|<w:r\b[^>]*>[\s\S]*?<v:imagedata[\s\S]*?<\/w:r>/g)]
    .map((m) => m[0])
    .join('');
  return `${open[0]}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>${drawings}</w:p>`;
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

function fillScoreGridTable(tableXml, values) {
  const rows = [...tableXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
  if (rows.length < 11) return tableXml;
  const headerCells = [...rows[0][0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => cellPlainText(c[0]));
  const header = headerCells.join(' ');
  if (!/مجال التقييم/.test(header) || !/(ممتاز|جيد)/.test(header)) return tableXml;

  let out = tableXml;
  for (let i = 1; i <= 10; i += 1) {
    const rowXml = rows[i]?.[0];
    if (!rowXml) continue;
    const score = criterionScore(values, i);
    const cells = [...rowXml.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    if (cells.length < 5) continue;
    let filledRow = rowXml;
    for (let col = 0; col < 5; col += 1) {
      const target = cells[col];
      if (!target) continue;
      const cellText = score != null && col === score - 1 ? CHECKMARK : '';
      const filledCell = replaceFirstParagraph(target[0], cellText);
      filledRow = filledRow.replace(target[0], filledCell);
    }
    out = out.replace(rowXml, filledRow);
  }

  const total = blank(values.professional_evaluation_total);
  if (total !== '') {
    const last = rows[rows.length - 1]?.[0];
    if (last && /المجموع/.test(cellPlainText(last))) {
      const cells = [...last.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const totalCell = cells.find((c) => /المجموع/.test(cellPlainText(c[0]))) || cells[cells.length - 1];
      if (totalCell) {
        out = out.replace(totalCell[0], replaceFirstParagraph(totalCell[0], `المجموع: ${total}`));
      }
    }
  }
  return out;
}

function countScoreGridCheckmarks(xml) {
  const tables = [...String(xml || '').matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  let count = 0;
  for (const table of tables) {
    const rows = [...table.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
    if (rows.length < 11) continue;
    const header = [...rows[0][0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => cellPlainText(c[0])).join(' ');
    if (!/مجال التقييم/.test(header) || !/(ممتاز|جيد)/.test(header)) continue;
    for (let i = 1; i <= 10; i += 1) {
      const cells = [...(rows[i]?.[0] || '').matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const marks = cells.slice(0, 5).filter((c) => cellPlainText(c[0]).includes(CHECKMARK)).length;
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
    return { key: 'actual_daily_hours', label: 'عدد الساعات اليومية (الفعلية) التي تدربها الطالب:' };
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
  if (/التاريخ/.test(t) && !/السنه|السنة/.test(t)) return { key: 'evaluation_date', label: 'التاريخ:' };
  return null;
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
    if (cellHasDrawing(cellXml)) {
      return replaceTextRunsContaining(cellXml, (inner) => /فترة|الى|إلى/.test(inner), filled);
    }
    return replaceFirstParagraph(cellXml, filled);
  }
  if (match.key === 'evaluation_date') {
    const value = blank(values.evaluation_date);
    if (value === '') return cellXml;
    if (cellHasDrawing(cellXml) || /توقيع/.test(text)) {
      return replaceTextRunsContaining(
        cellXml,
        (inner) => /التاريخ/.test(inner),
        `التاريخ: ${value}`
      );
    }
    return replaceFirstParagraph(cellXml, `التاريخ: ${value}`);
  }
  const value = blank(values[match.key]);
  if (value === '') return cellXml;
  const filled = `${match.label} ${value}`;
  if (cellHasDrawing(cellXml)) {
    const next = replaceTextRunsContaining(
      cellXml,
      (inner) => normalizeAr(inner).includes(normalizeAr(match.label.replace(':', ''))),
      filled
    );
    if (next !== cellXml) return next;
  }
  return replaceFirstParagraph(cellXml, filled);
}

function fillCommentsTable(tableXml, comments) {
  const text = cellPlainText(tableXml);
  if (text) return tableXml;
  if (!comments) return tableXml;
  return tableXml.replace(/<w:p\b[\s\S]*?<\/w:p>/, (p) => setParagraphText(p, comments));
}

function fillUniversityLabelForm(xml, values = {}) {
  if (!detectUniversityLabelForm(xml)) return xml;
  let out = xml;
  const tables = [...out.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  for (const table of tables) {
    let next = fillScoreGridTable(table, values);
    const header = cellPlainText(table);
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
  const comments = blank(values.general_comments);
  if (comments) {
    out = out.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (p) => {
      const paragraph = cellPlainText(p);
      if (!/ملاحظات عامه|ملاحظات عامة/.test(paragraph)) return p;
      if (paragraph.includes(comments)) return p;
      return setParagraphText(p, `${paragraph.replace(/:?\s*$/, ':')} ${comments}`);
    });
  }
  return out;
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
  cellPlainText,
  normalizeAr,
  matchLabelKey,
  countScoreGridCheckmarks,
  leftoverPlaceholders,
};
