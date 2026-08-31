'use strict';

const ExcelJS = require('exceljs');

const SHEET_NAME = 'طلاب التدريب الميداني';
const MAX_EXCEL_BYTES = 10 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HEADER_ALIASES = Object.freeze({
  universityNumber: ['الرقم الجامعي'],
  seq: ['م'],
  studentName: ['اسم الطالب'],
  supervisorName: ['المشرف الأكاديمي'],
  universityEmail: ['البريد الإلكتروني الجامعي'],
  specialty: ['التخصص'],
  university: ['الجامعة'],
  opportunity: ['فرصة التدريب'],
  hostOrganization: ['جهة التدريب'],
  applicationStatus: ['حالة الطلب'],
  trainingStatus: ['حالة التدريب'],
  eligibilityStatus: ['حالة الأهلية'],
  finalResult: ['النتيجة النهائية'],
  submittedAt: ['تاريخ التقديم'],
  supervisorEmail: ['البريد الإلكتروني للمشرف'],
  supervisorId: ['معرّف المشرف'],
});

const TEMPLATE_HEADERS = [
  'الرقم الجامعي',
  'م',
  'اسم الطالب',
  'المشرف الأكاديمي',
  'البريد الإلكتروني الجامعي',
  'التخصص',
  'الجامعة',
  'فرصة التدريب',
  'جهة التدريب',
  'حالة الطلب',
  'حالة التدريب',
  'حالة الأهلية',
  'النتيجة النهائية',
  'تاريخ التقديم',
  'البريد الإلكتروني للمشرف',
  'معرّف المشرف',
];

function normalizeHeader(value) {
  return String(value || '')
    .replace(/\u200f|\u200e/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePersonLabel(value) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeScopeLabel(value) {
  return normalizePersonLabel(value);
}

function cellDisplayText(cell) {
  if (!cell) return '';
  const text = cell.text != null ? String(cell.text).trim() : '';
  if (text && !/[eE][+-]?\d+$/.test(text.replace(/,/g, ''))) {
    return text.replace(/\.0+$/, '');
  }
  return serializeCellValue(cell.value);
}

function serializeCellValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.hyperlink && value.text) return String(value.text).trim();
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return serializeCellValue(value.result);
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('').trim();
    }
  }
  return String(value).trim();
}

function universityNumberFromCell(cell) {
  const raw = cellDisplayText(cell);
  if (!raw) return '';
  if (/[eE][+-]?\d+/.test(raw.replace(/,/g, ''))) {
    const num = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(num)) return String(Math.round(num));
  }
  const trimmed = raw.replace(/,/g, '').trim();
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.replace(/\.0+$/, '');
  return trimmed;
}

function mapHeaderRow(row) {
  const map = {};
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = normalizeHeader(cellDisplayText(cell) || serializeCellValue(cell.value));
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(label) && map[key] == null) {
        map[key] = colNumber;
      }
    }
  });
  return map;
}

function requiredHeadersPresent(headerMap) {
  return Boolean(headerMap.universityNumber && headerMap.studentName && headerMap.supervisorName);
}

function parseWorkbookRows(workbook) {
  const ws =
    workbook.getWorksheet(SHEET_NAME) ||
    workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) === SHEET_NAME) ||
    workbook.worksheets[0];
  if (!ws) {
    return { error: 'missing_sheet', rows: [], headerMap: {}, sheetName: null };
  }

  const headerMap = mapHeaderRow(ws.getRow(1));
  if (!requiredHeadersPresent(headerMap)) {
    return { error: 'missing_headers', rows: [], headerMap, sheetName: ws.name };
  }

  const rows = [];
  const last = ws.actualRowCount || ws.rowCount || 1;
  for (let index = 2; index <= last; index += 1) {
    const excelRow = ws.getRow(index);
    const get = (key) => {
      const col = headerMap[key];
      if (!col) return '';
      return key === 'universityNumber'
        ? universityNumberFromCell(excelRow.getCell(col))
        : cellDisplayText(excelRow.getCell(col)).trim();
    };
    const universityNumber = get('universityNumber');
    const studentName = get('studentName');
    const supervisorName = get('supervisorName');
    const universityEmail = get('universityEmail');
    const blank =
      !universityNumber &&
      !studentName &&
      !supervisorName &&
      !universityEmail &&
      !get('university') &&
      !get('opportunity');
    if (blank) continue;
    rows.push({
      excelRow: index,
      universityNumber,
      seq: get('seq'),
      studentName,
      studentNameNormalized: normalizePersonLabel(studentName),
      supervisorName,
      supervisorLabel: supervisorName.trim(),
      supervisorNormalized: normalizePersonLabel(supervisorName),
      universityEmail: universityEmail.trim(),
      specialty: get('specialty'),
      university: get('university'),
      universityNormalized: normalizeScopeLabel(get('university')),
      opportunity: get('opportunity'),
      opportunityNormalized: normalizeScopeLabel(get('opportunity')),
      hostOrganization: get('hostOrganization'),
      applicationStatus: get('applicationStatus'),
      trainingStatus: get('trainingStatus'),
      eligibilityStatus: get('eligibilityStatus'),
      finalResult: get('finalResult'),
      submittedAt: get('submittedAt'),
      supervisorEmail: get('supervisorEmail'),
      supervisorId: get('supervisorId'),
    });
  }
  return { error: null, rows, headerMap, sheetName: ws.name };
}

async function parseSupervisorAssignmentWorkbook(input) {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input);
  } else {
    await workbook.xlsx.readFile(input);
  }
  return parseWorkbookRows(workbook);
}

function detectRowIssues(rows) {
  const byNumber = new Map();
  const byEmail = new Map();
  const issues = [];

  rows.forEach((row, index) => {
    row.errors = [];
    if (!row.universityNumber) {
      row.errors.push({ code: 'missing_university_number', label: 'رقم جامعي فارغ' });
    } else if (!/^\d{6,14}$/.test(String(row.universityNumber).replace(/[\s-]/g, '')) && !String(row.universityNumber).trim()) {
      row.errors.push({ code: 'malformed_university_number', label: 'رقم جامعي غير صالح' });
    }
    if (row.universityNumber && /[eE]/.test(String(row.universityNumber))) {
      row.errors.push({ code: 'scientific_notation', label: 'الرقم الجامعي بصيغة علمية غير مقبولة' });
    }
    if (!row.universityEmail) {
      row.errors.push({ code: 'missing_email', label: 'بريد جامعي فارغ' });
    }
    if (!row.supervisorNormalized) {
      row.errors.push({ code: 'missing_supervisor', label: 'اسم المشرف فارغ' });
    }

    const numKey = String(row.universityNumber || '').trim();
    if (numKey) {
      const prev = byNumber.get(numKey);
      if (prev != null) {
        row.errors.push({ code: 'duplicate_university_number', label: 'رقم جامعي مكرر' });
        rows[prev].errors.push({ code: 'duplicate_university_number', label: 'رقم جامعي مكرر' });
      } else {
        byNumber.set(numKey, index);
      }
    }

    const emailKey = String(row.universityEmail || '').trim().toLowerCase();
    if (emailKey) {
      const prev = byEmail.get(emailKey);
      if (prev != null) {
        row.errors.push({ code: 'duplicate_email', label: 'بريد جامعي مكرر' });
        rows[prev].errors.push({ code: 'duplicate_email', label: 'بريد جامعي مكرر' });
      } else {
        byEmail.set(emailKey, index);
      }
    }
  });

  const byStudent = new Map();
  for (const row of rows) {
    const key = String(row.universityNumber || '').trim();
    if (!key) continue;
    const list = byStudent.get(key) || [];
    list.push(row);
    byStudent.set(key, list);
  }
  for (const list of byStudent.values()) {
    const supervisors = new Set(list.map((row) => row.supervisorNormalized).filter(Boolean));
    if (supervisors.size > 1) {
      for (const row of list) {
        row.errors.push({ code: 'conflicting_supervisor', label: 'تعارض في إسناد المشرف' });
      }
    }
  }

  return issues;
}

function groupRowsBySupervisor(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.supervisorNormalized || '__empty__';
    const current = groups.get(key) || {
      supervisorLabel: row.supervisorLabel || '',
      supervisorNormalized: row.supervisorNormalized || '',
      supervisorEmail: row.supervisorEmail || '',
      supervisorId: row.supervisorId || '',
      rows: [],
    };
    current.rows.push(row);
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.supervisorLabel.localeCompare(b.supervisorLabel, 'ar'));
}

function summarizeParse(rows) {
  detectRowIssues(rows);
  const groups = groupRowsBySupervisor(rows);
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => !row.errors?.length).length,
    invalidRows: rows.filter((row) => row.errors?.length).length,
    duplicateUniversityNumbers: rows.filter((row) =>
      row.errors?.some((err) => err.code === 'duplicate_university_number')
    ).length,
    duplicateEmails: rows.filter((row) => row.errors?.some((err) => err.code === 'duplicate_email')).length,
    conflictingAssignments: rows.filter((row) =>
      row.errors?.some((err) => err.code === 'conflicting_supervisor')
    ).length,
    missingUniversityNumbers: rows.filter((row) => !row.universityNumber).length,
    missingEmails: rows.filter((row) => !row.universityEmail).length,
    missingSupervisors: rows.filter((row) => !row.supervisorNormalized).length,
    distinctSupervisors: groups.filter((g) => g.supervisorNormalized).length,
    groups,
    universities: [...new Set(rows.map((row) => row.university).filter(Boolean))],
    opportunities: [...new Set(rows.map((row) => row.opportunity).filter(Boolean))],
  };
}

async function buildSupervisorAssignmentTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BATTECHNO LMS';
  const ws = workbook.addWorksheet(SHEET_NAME);
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  ws.addRow([...TEMPLATE_HEADERS]);
  ws.getRow(1).font = { bold: true };
  ws.columns = TEMPLATE_HEADERS.map((header) => ({
    width: Math.min(36, Math.max(14, header.length + 4)),
  }));
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    filename: 'نموذج_توزيع_المشرفين_الأكاديميين.xlsx',
    contentType: XLSX_MIME,
  };
}

function isXlsxUpload(file) {
  if (!file) return false;
  const name = String(file.originalname || file.name || '').toLowerCase();
  const type = String(file.mimetype || file.type || '').toLowerCase();
  return name.endsWith('.xlsx') || type === XLSX_MIME;
}

module.exports = {
  SHEET_NAME,
  MAX_EXCEL_BYTES,
  XLSX_MIME,
  TEMPLATE_HEADERS,
  HEADER_ALIASES,
  normalizeHeader,
  normalizePersonLabel,
  normalizeScopeLabel,
  universityNumberFromCell,
  parseSupervisorAssignmentWorkbook,
  detectRowIssues,
  groupRowsBySupervisor,
  summarizeParse,
  buildSupervisorAssignmentTemplate,
  isXlsxUpload,
};
