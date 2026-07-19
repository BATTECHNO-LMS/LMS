const ExcelJS = require('exceljs');

const CREATOR = 'BATTECHNO LMS';
const NAVY = 'FF132D4A';
const GOLD = 'FFC9A227';
const CREAM = 'FFFBF7EF';
const ALT_ROW = 'FFF7F1E7';
const WHITE = 'FFFFFFFF';
const GREEN_SOFT = 'FFE8F5EE';
const GOLD_SOFT = 'FFF3EAD4';
const RED_SOFT = 'FFF8E8E8';
const GRAY_SOFT = 'FFF0F2F5';

const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const TITLE_FONT = { ...AR_FONT, bold: true, size: 16, color: { argb: GOLD } };
const SUBTITLE_FONT = { ...AR_FONT, bold: true, size: 12, color: { argb: NAVY } };

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
const CREAM_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFE4E9F0' } },
  left: { style: 'thin', color: { argb: 'FFE4E9F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE4E9F0' } },
  right: { style: 'thin', color: { argb: 'FFE4E9F0' } },
};

const ROLE_LABELS_AR = {
  super_admin: 'مدير عام',
  program_admin: 'إداري البرنامج (متوقف)',
  university_admin: 'مدير جامعة',
  academic_admin: 'مراجع أكاديمي',
  qa_officer: 'مسؤول جودة',
  instructor: 'مدرّس',
  student: 'طالب',
  university_reviewer: 'مراجع جامعي',
};

const STATUS_LABELS_AR = {
  active: 'مفعل',
  inactive: 'غير مفعل',
  suspended: 'موقوف',
};

function cellText(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function roleLabelAr(code) {
  if (!code) return '';
  return ROLE_LABELS_AR[String(code)] || String(code);
}

function statusLabelAr(status) {
  if (!status) return '';
  return STATUS_LABELS_AR[String(status)] || String(status);
}

function formatDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function sanitizeFilenamePart(name) {
  // HTTP Content-Disposition requires ASCII; keep Latin/digits only.
  const cleaned = String(name || '')
    .normalize('NFKC')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || 'University';
}

function buildContentDisposition(filename) {
  const safeAscii = String(filename || 'export.xlsx')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function buildExportFilename({ universityName, universityId, allUniversities }) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (allUniversities || (!universityName && !universityId)) {
    return `BATTECHNO_Users_All_Universities_${stamp}.xlsx`;
  }
  const namePart = sanitizeFilenamePart(universityName);
  const idPart =
    namePart === 'University' && universityId
      ? String(universityId).replace(/-/g, '').slice(0, 8)
      : namePart;
  return `BATTECHNO_Users_${idPart}_${stamp}.xlsx`;
}

function setupRtlSheet(ws, freezeY = 1) {
  ws.views = [{ state: 'frozen', ySplit: freezeY, rightToLeft: true, activeCell: 'A1' }];
}

function applyBorder(cell) {
  cell.border = THIN_BORDER;
}

function styleHeaderRow(ws, rowNum, colCount) {
  const row = ws.getRow(rowNum);
  row.height = 26;
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyBorder(cell);
  }
}

function statusFill(label) {
  if (label === 'موثق' || label === 'مفعل') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } };
  }
  if (label === 'غير موثق') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD_SOFT } };
  }
  if (label === 'غير مفعل') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_SOFT } };
  }
  if (label === 'موقوف') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: RED_SOFT } };
  }
  return null;
}

function addSummaryKv(ws, startRow, pairs) {
  let r = startRow;
  pairs.forEach(([key, value]) => {
    const row = ws.getRow(r);
    const keyCell = row.getCell(1);
    const valCell = row.getCell(2);
    keyCell.value = key;
    valCell.value = value == null || value === '' ? '—' : value;
    keyCell.font = { ...AR_FONT, bold: true, color: { argb: NAVY } };
    valCell.font = AR_FONT;
    keyCell.fill = CREAM_FILL;
    keyCell.alignment = { vertical: 'middle', horizontal: 'right' };
    valCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
    applyBorder(keyCell);
    applyBorder(valCell);
    r += 1;
  });
  return r;
}

/**
 * @param {{
 *   users: object[],
 *   meta: {
 *     scopeLabel: string,
 *     universityName: string | null,
 *     allUniversities: boolean,
 *     exportedBy: string,
 *     exportedAt: Date,
 *     filtersApplied: boolean,
 *     filtersSummary: string,
 *   }
 * }} payload
 */
async function buildUsersExportWorkbook(payload) {
  const { users, meta } = payload;
  const wb = new ExcelJS.Workbook();
  wb.creator = CREATOR;
  wb.created = meta.exportedAt || new Date();

  const verified = users.filter((u) => u.email_verified_at).length;
  const unverified = users.length - verified;
  const active = users.filter((u) => u.status === 'active').length;
  const inactive = users.filter((u) => u.status === 'inactive').length;
  const suspended = users.filter((u) => u.status === 'suspended').length;

  const byRole = new Map();
  const byUniversity = new Map();
  for (const u of users) {
    const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : ['—'];
    roles.forEach((code) => {
      const label = roleLabelAr(code);
      byRole.set(label, (byRole.get(label) || 0) + 1);
    });
    const uniName = u.university_name || 'بدون جامعة';
    byUniversity.set(uniName, (byUniversity.get(uniName) || 0) + 1);
  }

  // —— Sheet 1: الملخص ——
  const summary = wb.addWorksheet('الملخص', {
    properties: { defaultRowHeight: 20 },
    views: [{ rightToLeft: true }],
  });
  summary.mergeCells('A1:B1');
  const titleCell = summary.getCell('A1');
  titleCell.value = 'تقرير تصدير المستخدمين — BATTECHNO LMS';
  titleCell.font = TITLE_FONT;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(1).height = 32;

  summary.mergeCells('A2:B2');
  const sub = summary.getCell('A2');
  sub.value = 'إدارة المستخدمين';
  sub.font = SUBTITLE_FONT;
  sub.fill = CREAM_FILL;
  sub.alignment = { vertical: 'middle', horizontal: 'center' };

  let row = 4;
  row = addSummaryKv(summary, row, [
    ['عنوان التقرير', 'تصدير بيانات المستخدمين'],
    ['نطاق التصدير', meta.scopeLabel],
    ['الجامعة', meta.universityName || 'جميع الجامعات'],
    ['تاريخ ووقت التصدير', formatDateTime(meta.exportedAt)],
    ['تم التصدير بواسطة', meta.exportedBy || '—'],
    ['تطبيق الفلاتر الحالية', meta.filtersApplied ? 'نعم' : 'لا'],
    ['ملخص الفلاتر', meta.filtersSummary || '—'],
    ['إجمالي المستخدمين', users.length],
    ['البريد الموثق', verified],
    ['البريد غير الموثق', unverified],
    ['الحسابات المفعلة', active],
    ['الحسابات غير المفعلة', inactive],
    ['الحسابات الموقوفة', suspended],
  ]);

  row += 1;
  summary.getCell(`A${row}`).value = 'المستخدمون حسب الدور';
  summary.getCell(`A${row}`).font = SUBTITLE_FONT;
  summary.getCell(`A${row}`).fill = CREAM_FILL;
  summary.mergeCells(`A${row}:B${row}`);
  row += 1;
  if (byRole.size === 0) {
    row = addSummaryKv(summary, row, [['—', 0]]);
  } else {
    row = addSummaryKv(
      summary,
      row,
      [...byRole.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])
    );
  }

  row += 1;
  summary.getCell(`A${row}`).value = 'المستخدمون حسب الجامعة';
  summary.getCell(`A${row}`).font = SUBTITLE_FONT;
  summary.getCell(`A${row}`).fill = CREAM_FILL;
  summary.mergeCells(`A${row}:B${row}`);
  row += 1;
  if (byUniversity.size === 0) {
    row = addSummaryKv(summary, row, [['—', 0]]);
  } else {
    row = addSummaryKv(
      summary,
      row,
      [...byUniversity.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ar')).map(([k, v]) => [k, v])
    );
  }

  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 48;

  // —— Sheet 2: المستخدمون ——
  const usersWs = wb.addWorksheet('المستخدمون', {
    properties: { defaultRowHeight: 20 },
  });
  setupRtlSheet(usersWs, 1);

  const headers = [
    'الرقم',
    'الاسم الكامل',
    'البريد الإلكتروني',
    'رقم الهاتف',
    'الرقم الجامعي',
    'الجامعة',
    'الكلية',
    'التخصص الجامعي',
    'التخصص المرجعي',
    'الدور',
    'حالة توثيق البريد',
    'حالة الحساب',
    'تاريخ إنشاء الحساب',
    'آخر تسجيل دخول',
  ];
  usersWs.addRow(headers);
  styleHeaderRow(usersWs, 1, headers.length);
  usersWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const centerCols = new Set([1, 10, 11, 12]);
  const textCols = new Set([4, 5]);

  users.forEach((u, index) => {
    const emailVerifiedLabel = u.email_verified_at ? 'موثق' : 'غير موثق';
    const accountLabel = statusLabelAr(u.status);
    const rolesLabel = (Array.isArray(u.roles) ? u.roles : []).map(roleLabelAr).filter(Boolean).join('، ') || '';

    const values = [
      index + 1,
      cellText(u.full_name),
      cellText(u.email),
      cellText(u.phone),
      '', // الرقم الجامعي — غير موجود في المخطط الحالي
      cellText(u.university_name),
      cellText(u.college_name),
      cellText(u.university_specialty_name),
      cellText(u.specialty_name),
      rolesLabel,
      emailVerifiedLabel,
      accountLabel,
      formatDateTime(u.created_at),
      formatDateTime(u.last_login_at),
    ];

    const excelRow = usersWs.addRow(values);
    const isAlt = index % 2 === 1;
    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = AR_FONT;
      cell.alignment = {
        vertical: 'middle',
        horizontal: centerCols.has(colNumber) ? 'center' : 'right',
        wrapText: true,
      };
      applyBorder(cell);
      if (isAlt) cell.fill = ALT_FILL;
      if (textCols.has(colNumber)) {
        cell.numFmt = '@';
        if (cell.value != null && cell.value !== '') cell.value = String(cell.value);
      }
      if (colNumber === 11 || colNumber === 12) {
        const fill = statusFill(String(cell.value || ''));
        if (fill) cell.fill = fill;
      }
    });
  });

  const widths = [8, 28, 32, 16, 16, 26, 22, 24, 22, 18, 16, 14, 18, 18];
  widths.forEach((w, i) => {
    usersWs.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: buildExportFilename({
      universityName: meta.universityName,
      universityId: meta.universityId || null,
      allUniversities: meta.allUniversities,
    }),
    exportedCount: users.length,
  };
}

module.exports = {
  buildUsersExportWorkbook,
  buildExportFilename,
  buildContentDisposition,
  roleLabelAr,
  statusLabelAr,
  formatDateTime,
  sanitizeFilenamePart,
};
