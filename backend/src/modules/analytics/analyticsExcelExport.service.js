const ExcelJS = require('exceljs');
const exportRepo = require('./analyticsExcelExport.repository');

const CREATOR = 'BATTECHNO LMS';
const NAVY = 'FF1B2A4A';
const GOLD = 'FFD4AF37';
const CREAM = 'FFFFF8F0';
const ALT_ROW = 'FFF5F7FA';
const WHITE = 'FFFFFFFF';

const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const TITLE_FONT = { ...AR_FONT, bold: true, size: 16, color: { argb: WHITE } };
const SUBTITLE_FONT = { ...AR_FONT, bold: true, size: 12, color: { argb: NAVY } };

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
const GOLD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
const CREAM_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  right: { style: 'thin', color: { argb: 'FFD0D5DD' } },
};

function buildFilename() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `BATTECHNO-LMS-Analytics-Report-${stamp}.xlsx`;
}

function formatScopeLabel(universityScopeName) {
  return universityScopeName || 'جميع الجامعات';
}

function formatDateRange(filters) {
  if (!filters.from && !filters.to) return 'جميع الفترات';
  if (filters.from && filters.to) return `${filters.from} — ${filters.to}`;
  if (filters.from) return `من ${filters.from}`;
  return `حتى ${filters.to}`;
}

function setupRtlSheet(ws) {
  ws.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
}

function applyCellBorder(cell) {
  cell.border = THIN_BORDER;
}

function styleHeaderRow(ws, rowNum, colCount) {
  for (let c = 1; c <= colCount; c += 1) {
    const cell = ws.getRow(rowNum).getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyCellBorder(cell);
  }
  ws.getRow(rowNum).height = 24;
}

function styleDataRows(ws, startRow, endRow, colCount, options = {}) {
  const { percentCols = [], numberCols = [], dateCols = [] } = options;
  for (let r = startRow; r <= endRow; r += 1) {
    const isAlt = (r - startRow) % 2 === 1;
    for (let c = 1; c <= colCount; c += 1) {
      const cell = ws.getRow(r).getCell(c);
      cell.font = AR_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      if (isAlt) cell.fill = ALT_FILL;
      applyCellBorder(cell);
      if (percentCols.includes(c) && typeof cell.value === 'number') {
        cell.numFmt = '0.00%';
        cell.value = cell.value / 100;
      }
      if (numberCols.includes(c) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
      if (dateCols.includes(c) && cell.value) {
        cell.numFmt = 'yyyy-mm-dd';
      }
    }
  }
}

function autoWidth(ws, minWidth = 12, maxWidth = 40) {
  ws.columns.forEach((col) => {
    let maxLen = minWidth;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      maxLen = Math.max(maxLen, Math.min(len + 2, maxWidth));
    });
    col.width = maxLen;
  });
}

function addTableSheet(ws, headers, rows, options = {}) {
  const { headerRow = 1, percentCols = [], numberCols = [], dateCols = [], freezeRow = 1 } = options;
  ws.addRow(headers);
  styleHeaderRow(ws, headerRow, headers.length);
  rows.forEach((row) => ws.addRow(row));
  const endRow = headerRow + rows.length;
  if (rows.length) {
    styleDataRows(ws, headerRow + 1, endRow, headers.length, { percentCols, numberCols, dateCols });
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: endRow, column: headers.length },
    };
  }
  ws.views = [{ state: 'frozen', ySplit: freezeRow, rightToLeft: true }];
  autoWidth(ws);
}

function addExecutiveSummarySheet(wb, data) {
  const ws = wb.addWorksheet('الملخص التنفيذي', { views: [{ rightToLeft: true }] });
  const kpis = data.overview?.kpis || {};
  const scopeLabel = formatScopeLabel(data.universityScopeName);
  const dateRange = formatDateRange(data.filters);
  const generatedAt = data.generatedAt.toISOString().replace('T', ' ').slice(0, 19);
  const generatorLine = data.generator?.name
    ? `${data.generator.name}${data.generator.role ? ` (${data.generator.role})` : ''}`
    : 'غير متوفر';

  ws.mergeCells('A1:D1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'تقرير تحليلات BATTECHNO LMS';
  titleCell.font = TITLE_FONT;
  titleCell.fill = HEADER_FILL;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells('A2:D2');
  const accentCell = ws.getCell('A2');
  accentCell.fill = GOLD_FILL;
  accentCell.value = '';

  const metaRows = [
    ['تاريخ الإنشاء', generatedAt],
    ['أُنشئ بواسطة', generatorLine],
    ['نطاق الجامعة', scopeLabel],
    ['الفترة الزمنية', dateRange],
  ];

  let row = 4;
  for (const [label, value] of metaRows) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { ...AR_FONT, bold: true };
    ws.getCell(`A${row}`).fill = CREAM_FILL;
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = value;
    ws.getCell(`B${row}`).font = AR_FONT;
    ws.getCell(`B${row}`).fill = CREAM_FILL;
    row += 1;
  }

  row += 1;
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = 'مؤشرات الأداء الرئيسية (KPIs)';
  ws.getCell(`A${row}`).font = SUBTITLE_FONT;
  row += 1;

  const kpiDefs = [
    ['الجامعات', kpis.universities],
    ['المستخدمون النشطون', kpis.activeUsers],
    ['الطلاب المسجلون', kpis.enrolledStudents],
    ['الدفعات النشطة', kpis.activeCohorts],
    ['الشهادات المصغّرة', kpis.microCredentials],
    ['معدل الحضور', kpis.attendanceRatePct != null ? `${kpis.attendanceRatePct}%` : 'غير متوفر'],
    ['التقييمات المتأخرة', kpis.delayedAssessments],
    ['الأدلة الناقصة', kpis.missingEvidence],
    ['طلبات الاعتراف الجاهزة', kpis.recognitionReady],
    ['قضايا الجودة المفتوحة', kpis.openQaIssues],
    ['قضايا النزاهة المفتوحة', kpis.openIntegrityCases],
    ['الشهادات الصادرة', kpis.certificatesIssued],
  ];

  ws.getRow(row).values = ['المؤشر', 'القيمة', '', ''];
  ws.mergeCells(`B${row}:D${row}`);
  styleHeaderRow(ws, row, 4);
  row += 1;

  for (const [label, value] of kpiDefs) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { ...AR_FONT, bold: true };
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = value ?? 'غير متوفر';
    ws.getCell(`B${row}`).font = AR_FONT;
    ws.getCell(`A${row}`).fill = (row % 2 === 0) ? ALT_FILL : undefined;
    ws.getCell(`B${row}`).fill = (row % 2 === 0) ? ALT_FILL : undefined;
    applyCellBorder(ws.getCell(`A${row}`));
    applyCellBorder(ws.getCell(`B${row}`));
    row += 1;
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 8;
  ws.getColumn(4).width = 8;
}

function addUniversitiesSheet(wb, rows) {
  const ws = wb.addWorksheet('الأداء حسب الجامعة');
  addTableSheet(
    ws,
    [
      'الجامعة',
      'عدد المستخدمين',
      'عدد الطلاب',
      'عدد المدربين',
      'عدد الدفعات',
      'عدد الشهادات المصغّرة',
      'عدد التسجيلات',
      'معدل الحضور',
      'الشهادات الصادرة',
      'طلبات الاعتراف',
      'قضايا الجودة',
      'قضايا النزاهة',
      'ملاحظات',
    ],
    rows.map((r) => [
      r.university,
      r.usersCount,
      r.studentsCount,
      r.instructorsCount,
      r.cohortsCount,
      r.microCredentialsCount,
      r.enrollmentsCount,
      r.attendanceRatePct != null ? r.attendanceRatePct : 'غير متوفر',
      r.certificatesIssued,
      r.recognitionRequests,
      r.qaIssues,
      r.integrityIssues,
      r.notes,
    ]),
    { numberCols: [2, 3, 4, 5, 6, 7, 9, 10, 11, 12], percentCols: [8] }
  );
}

function addEnrollmentsSheet(wb, data) {
  const ws = wb.addWorksheet('التسجيلات والطلاب');
  ws.views = [{ rightToLeft: true }];

  const summary = data.enrollments.summary;
  ws.addRow(['ملخص التسجيلات']);
  ws.getCell('A1').font = SUBTITLE_FONT;
  ws.addRow(['معلق', summary.pending]);
  ws.addRow(['مسجل / معتمد', summary.enrolled]);
  ws.addRow(['مرفوض', summary.rejected]);
  ws.addRow(['غير نشط', summary.inactive]);
  ws.addRow([]);

  const headerRow = 7;
  const headers = [
    'الجامعة',
    'الدفعة',
    'الشهادة المصغّرة',
    'الطالب',
    'البريد الإلكتروني',
    'حالة التسجيل',
    'تاريخ التسجيل',
    'تاريخ الاعتماد',
    'ملاحظات',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headerRow, headers.length);

  const rows = data.enrollments.rows;
  rows.forEach((r) => {
    ws.addRow([
      r.university,
      r.cohort,
      r.microCredential,
      r.student,
      r.email,
      r.enrollmentStatus,
      r.enrolledAt,
      r.approvedAt || 'غير متوفر',
      r.notes,
    ]);
  });

  if (rows.length) {
    styleDataRows(ws, headerRow + 1, headerRow + rows.length, headers.length, { dateCols: [7, 8] });
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + rows.length, column: headers.length },
    };
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow, rightToLeft: true }];
  autoWidth(ws);
}

function addCohortsSessionsSheet(wb, rows) {
  const ws = wb.addWorksheet('الدفعات والجلسات');
  addTableSheet(
    ws,
    [
      'الجامعة',
      'المسار',
      'الشهادة المصغّرة',
      'الدفعة',
      'الحالة',
      'المدرب',
      'تاريخ البداية',
      'تاريخ النهاية',
      'عدد الطلاب',
      'عدد الجلسات',
      'نسبة الإنجاز',
    ],
    rows.map((r) => [
      r.university,
      r.track,
      r.microCredential,
      r.cohort,
      r.status,
      r.instructor,
      r.startDate,
      r.endDate,
      r.studentsCount,
      r.sessionsCount,
      r.completionPct != null ? `${r.completionPct}%` : 'غير متوفر',
    ]),
    { numberCols: [9, 10], dateCols: [7, 8] }
  );
}

function addAttendanceSheet(wb, data) {
  const ws = wb.addWorksheet('الحضور');
  ws.views = [{ rightToLeft: true }];

  const { summary, rows } = data.attendance;
  ws.addRow(['ملخص الحضور']);
  ws.getCell('A1').font = SUBTITLE_FONT;
  ws.addRow([
    'معدل الحضور الإجمالي',
    summary.overallRate != null ? `${summary.overallRate}%` : 'غير متوفر',
  ]);
  ws.addRow([]);
  ws.addRow(['الحضور حسب الجامعة']);
  ws.addRow(['الجامعة', 'معدل الحضور']);
  for (const u of summary.byUniversity || []) {
    ws.addRow([u.university, u.ratePct != null ? `${u.ratePct}%` : 'غير متوفر']);
  }
  if (summary.lowWarnings?.length) {
    ws.addRow([]);
    ws.addRow(['تحذيرات حضور منخفض']);
    ws.addRow(['الجامعة', 'الدفعة', 'عدد الطلاب']);
    for (const w of summary.lowWarnings) {
      ws.addRow([w.university, w.cohort, w.lowCount]);
    }
  }
  ws.addRow([]);

  const headerRow = ws.lastRow.number + 1;
  const headers = [
    'الجامعة',
    'الدفعة',
    'الجلسة',
    'التاريخ',
    'الطالب',
    'الحالة',
    'حاضر / متأخر / غائب / بعذر',
    'ملاحظات',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headerRow, headers.length);

  rows.forEach((r) => {
    ws.addRow([
      r.university,
      r.cohort,
      r.session,
      r.sessionDate,
      r.student,
      r.status,
      r.statusLabel,
      r.notes,
    ]);
  });

  if (rows.length) {
    styleDataRows(ws, headerRow + 1, headerRow + rows.length, headers.length, { dateCols: [4] });
    ws.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + rows.length, column: headers.length },
    };
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow, rightToLeft: true }];
  autoWidth(ws);
}

function addAssessmentsSheet(wb, rows) {
  const ws = wb.addWorksheet('التقييمات والدرجات');
  addTableSheet(
    ws,
    [
      'الجامعة',
      'الدفعة',
      'التقييم',
      'نوع التقييم',
      'الحالة',
      'تاريخ الاستحقاق',
      'عدد التسليمات',
      'عدد الدرجات',
      'متوسط الدرجة',
      'التقييمات المتأخرة',
      'ملاحظات',
    ],
    rows.map((r) => [
      r.university,
      r.cohort,
      r.assessment,
      r.assessmentType,
      r.status,
      r.dueDate,
      r.submissionsCount,
      r.gradesCount,
      r.avgScore ?? 'غير متوفر',
      r.delayedCount,
      r.notes,
    ]),
    { numberCols: [7, 8, 9, 10], dateCols: [6] }
  );
}

function addQaRiskSheet(wb, rows) {
  const ws = wb.addWorksheet('الجودة والمخاطر');
  addTableSheet(
    ws,
    [
      'القسم',
      'الجامعة',
      'الدفعة',
      'النوع',
      'الحالة',
      'الأولوية / الخطورة',
      'المسؤول',
      'تاريخ الإنشاء',
      'تاريخ الإغلاق',
      'ملاحظات',
    ],
    rows.map((r) => [
      r.section,
      r.university,
      r.cohort,
      r.type,
      r.status,
      r.priority,
      r.assignee,
      r.createdAt,
      r.closedAt || '—',
      r.notes,
    ]),
    { dateCols: [8, 9] }
  );
}

function addCertificatesSheet(wb, rows) {
  const ws = wb.addWorksheet('الشهادات');
  addTableSheet(
    ws,
    [
      'الجامعة',
      'الطالب',
      'الشهادة المصغّرة',
      'الدفعة',
      'رقم الشهادة',
      'حالة الشهادة',
      'تاريخ الإصدار',
      'رمز التحقق',
      'حالة التحقق',
      'ملاحظات',
    ],
    rows.map((r) => [
      r.university,
      r.student,
      r.microCredential,
      r.cohort,
      r.certificateNo,
      r.status,
      r.issuedAt,
      r.verificationCode,
      r.verificationStatus,
      r.notes,
    ]),
    { dateCols: [7] }
  );
}

function addFieldTrainingSheet(wb, fieldTraining) {
  const ws = wb.addWorksheet('التدريب الميداني');
  if (!fieldTraining.available || !fieldTraining.rows.length) {
    ws.views = [{ rightToLeft: true }];
    ws.mergeCells('A1:J1');
    const cell = ws.getCell('A1');
    cell.value = 'لا توجد بيانات تدريب ميداني متاحة ضمن نطاق التقرير الحالي.';
    cell.font = { ...AR_FONT, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = CREAM_FILL;
    ws.getRow(1).height = 40;
    autoWidth(ws);
    return;
  }

  addTableSheet(
    ws,
    [
      'الجامعة',
      'فرصة التدريب',
      'نوع التدريب',
      'الحالة',
      'المكان',
      'عدد المقاعد',
      'عدد الطلبات',
      'المشاركون المعتمدون',
      'عدد المهام',
      'عدد التسليمات',
      'عدد الجلسات',
      'نسبة الحضور %',
      'المستبعدون',
      'كتب الإنهاء',
      'آخر تحديث',
    ],
    fieldTraining.rows.map((r) => [
      r.university,
      r.opportunity,
      r.trainingMode,
      r.status,
      r.location,
      r.seatsLimit ?? 'غير متوفر',
      r.applicationsCount,
      r.approvedParticipants ?? 0,
      r.tasksCount,
      r.submissionsCount,
      r.sessionsCount ?? 0,
      r.attendanceRate != null ? r.attendanceRate : 'غير متوفر',
      r.expelledCount ?? 0,
      r.completionLettersCount ?? 0,
      r.lastUpdated,
    ]),
    { numberCols: [6, 7, 8, 9, 10, 11, 13, 14] }
  );
}

function addNotificationsSheet(wb, rows) {
  const ws = wb.addWorksheet('الإشعارات والنشاط');
  addTableSheet(
    ws,
    [
      'المصدر',
      'التاريخ',
      'المستخدم',
      'الدور',
      'النوع',
      'العنوان',
      'الحالة',
      'رابط الإجراء',
      'الإجراء',
      'الكيان',
    ],
    rows.map((r) => [
      r.source,
      r.date,
      r.user,
      r.role,
      r.type,
      r.title,
      r.status,
      r.actionUrl || '—',
      r.action || '—',
      r.entity || '—',
    ])
  );
}

function addRawDataSheet(wb, rows) {
  const ws = wb.addWorksheet('البيانات الخام');
  addTableSheet(
    ws,
    ['الفئة', 'المفتاح', 'التسمية', 'القيمة', 'بيانات إضافية'],
    rows.map((r) => [r.category, r.key, r.label, r.value, r.extra]),
    { numberCols: [4] }
  );
}

function addReportNotesSheet(wb, data) {
  const ws = wb.addWorksheet('ملاحظات التقرير');
  ws.views = [{ rightToLeft: true }];

  const scopeLabel = formatScopeLabel(data.universityScopeName);
  const dateRange = formatDateRange(data.filters);
  const generatedAt = data.generatedAt.toISOString().replace('T', ' ').slice(0, 19);

  const notes = [
    ['عنوان التقرير', 'تقرير تحليلات BATTECHNO LMS — تقرير إداري'],
    ['تاريخ الإنشاء', generatedAt],
    ['نطاق الجامعة', scopeLabel],
    ['الفترة الزمنية', dateRange],
    [''],
    ['تعريف مؤشرات الأداء', ''],
    ['الجامعات', 'عدد الجامعات ضمن نطاق التقرير'],
    ['المستخدمون النشطون', 'المستخدمون ذوو الحالة active (مع تصفية الجامعة إن وُجدت)'],
    ['الطلاب المسجلون', 'عدد الطلاب الفريدين في التسجيلات ضمن النطاق والفترة'],
    ['الدفعات النشطة', 'الدفعات ذات الحالة active ضمن النطاق'],
    ['معدل الحضور', 'نسبة السجلات (حاضر + متأخر + بعذر) من إجمالي سجلات الحضور'],
    ['التقييمات المتأخرة', 'تقييمات تجاوزت تاريخ الاستحقاق ولم تُقيّم بالكامل'],
    ['الأدلة الناقصة', 'جلسات بدون ملفات أدلة مرتبطة'],
    [''],
    ['ملاحظات مهمة', ''],
    ['مصدر البيانات', 'قاعدة بيانات BATTECHNO LMS — بيانات حقيقية فقط'],
    ['البيانات الحساسة', 'لا يتم تصدير كلمات المرور أو الرموز الداخلية'],
    ['التدريب الميداني', data.fieldTraining.available ? 'متاح ضمن النطاق' : 'غير متوفر في قاعدة البيانات'],
    [''],
    ['أُنشئ بواسطة', CREATOR],
  ];

  notes.forEach((row, idx) => {
    ws.addRow(row);
    if (row[0] && !row[1] && row[0] !== '') {
      ws.getCell(`A${idx + 1}`).font = SUBTITLE_FONT;
    } else if (row[0]) {
      ws.getCell(`A${idx + 1}`).font = { ...AR_FONT, bold: true };
    }
    ws.getCell(`B${idx + 1}`).font = AR_FONT;
    ws.getCell(`A${idx + 1}`).alignment = { wrapText: true, horizontal: 'right' };
    ws.getCell(`B${idx + 1}`).alignment = { wrapText: true, horizontal: 'right' };
  });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 60;
}

/**
 * @param {import('./analytics.validation').AnalyticsFilters} filters
 * @param {{ userId?: string }} authUser
 */
async function generateAnalyticsExcel(filters, authUser = {}) {
  const data = await exportRepo.fetchExcelExportData(filters, authUser);

  const wb = new ExcelJS.Workbook();
  wb.creator = CREATOR;
  wb.created = data.generatedAt;
  wb.modified = data.generatedAt;

  addExecutiveSummarySheet(wb, data);
  addUniversitiesSheet(wb, data.universitiesPerformance);
  addEnrollmentsSheet(wb, data);
  addCohortsSessionsSheet(wb, data.cohortsSessions);
  addAttendanceSheet(wb, data);
  addAssessmentsSheet(wb, data.assessments);
  addQaRiskSheet(wb, data.qaRisk);
  addCertificatesSheet(wb, data.certificates);
  addFieldTrainingSheet(wb, data.fieldTraining);
  addNotificationsSheet(wb, data.notificationsActivity);
  addRawDataSheet(wb, data.rawData);
  addReportNotesSheet(wb, data);

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: buildFilename(),
  };
}

module.exports = { generateAnalyticsExcel, buildFilename };
