'use strict';

const ExcelJS = require('exceljs');
const { REPORT_TYPE_TITLES_AR } = require('./trainingReportMetrics.service');

const NAVY = 'FF132D4A';
const WHITE = 'FFFFFFFF';
const ALT = 'FFF7F1E7';
const AR_FONT = { name: 'Arial', size: 11 };
const HEADER_FONT = { ...AR_FONT, bold: true, color: { argb: WHITE } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };

function setupRtl(ws) {
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
}

function styleHeader(ws, rowNum, colCount) {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 22;
}

function addKvSheet(wb, name, title, rows) {
  const ws = wb.addWorksheet(name);
  setupRtl(ws);
  ws.addRow([title]);
  ws.getRow(1).font = { ...AR_FONT, bold: true, size: 14, color: { argb: NAVY } };
  ws.addRow(['الحقل', 'القيمة']);
  styleHeader(ws, 2, 2);
  rows.forEach(([k, v], idx) => {
    const row = ws.addRow([k, v ?? 'غير متوفر']);
    if (idx % 2) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
      });
    }
  });
  ws.columns = [{ width: 36 }, { width: 48 }];
  ws.autoFilter = { from: 'A2', to: 'B2' };
  return ws;
}

function addTableSheet(wb, name, headers, rows) {
  const ws = wb.addWorksheet(name);
  setupRtl(ws);
  ws.addRow(headers);
  styleHeader(ws, 1, headers.length);
  rows.forEach((r, idx) => {
    const row = ws.addRow(r.map((c) => (c == null ? 'غير متوفر' : c)));
    if (idx % 2) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT } };
      });
    }
  });
  ws.columns = headers.map(() => ({ width: 18 }));
  if (headers.length) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }
  return ws;
}

async function renderTrainingReportExcel(report, { includeRaw = false } = {}) {
  const snap = report.snapshot_json || {};
  const meta = snap.meta || {};
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATTECHNO LMS';
  wb.created = new Date();

  const title = REPORT_TYPE_TITLES_AR[report.report_type] || meta.reportTitle || 'تقرير';

  addKvSheet(wb, '01_ملخص_تنفيذي', title, [
    ['نوع التقرير', title],
    ['الدورة', meta.courseName || snap.courseInfo?.name],
    ['المؤسسة', meta.institutionName],
    ['المرجع', report.reference_code],
    ['الإصدار', report.version],
    ['تاريخ التوليد', report.generated_at],
    ['عدد المتدربين', snap.executiveSummary?.traineeCount ?? snap.counts?.total],
    ['نسبة الإكمال', snap.executiveSummary?.completionRate ?? snap.completionRate],
    ['متوسط الحضور', snap.executiveSummary?.averageAttendance ?? snap.attendance?.average],
    ['NPS', snap.executiveSummary?.nps ?? snap.nps?.index],
    ['التوصية', snap.recommendation || snap.summary || ''],
  ]);

  addKvSheet(wb, '02_معلومات_الدورة', 'معلومات الدورة', [
    ['الاسم', snap.courseInfo?.name || meta.courseName],
    ['الرمز', snap.courseInfo?.code || meta.courseCode],
    ['المستوى', snap.courseInfo?.level || meta.level],
    ['اللغة', snap.courseInfo?.language || meta.language],
    ['نمط التقديم', snap.courseInfo?.deliveryMode || meta.deliveryMode],
    ['الساعات', snap.courseInfo?.hours || meta.totalHours],
    ['الفروع', (snap.courseInfo?.branches || meta.branches || []).join('، ')],
    ['المدربون', (snap.courseInfo?.trainers || []).join('، ') || (meta.trainers || []).map((t) => t.fullName).join('، ')],
  ]);

  if (snap.identity) {
    addKvSheet(wb, '03_المتدربون', 'هوية المتدرب', Object.entries(snap.identity));
  } else if (snap.enrollmentFunnel) {
    addTableSheet(
      wb,
      '03_المتدربون',
      ['المرحلة', 'العدد', '%', 'التحويل'],
      snap.enrollmentFunnel.map((s) => [s.label, s.count, s.percentageOfTotal, s.conversionFromPrevious])
    );
  } else {
    addKvSheet(wb, '03_المتدربون', 'المتدربون', [['ملاحظة', 'لا توجد بيانات متدربين في هذا النوع']]);
  }

  addKvSheet(wb, '04_الحضور', 'الحضور', [
    ['متوسط الحضور', snap.attendance?.average ?? snap.attendance?.attendancePct],
    ['الجلسات', snap.attendance?.totalSessions ?? snap.sessionCount],
    ['ساعات مكتملة', snap.attendance?.hoursCompleted ?? snap.attendance?.totalAttendedTraineeHours],
    ['أقل من العتبة', snap.attendance?.belowThreshold],
  ]);

  if (snap.bySession?.length) {
    addTableSheet(
      wb,
      '04ب_حضور_الجلسات',
      ['الجلسة', 'التاريخ', 'حاضر', 'الإجمالي', '%'],
      snap.bySession.map((s) => [s.title, s.dateLabel, s.present, s.total, s.attendancePct])
    );
  }

  addKvSheet(wb, '05_الاختبار_القبلي', 'الاختبار القبلي', [
    ['المتوسط', snap.preTest?.average ?? snap.preTest?.score],
    ['الوسيط', snap.preTest?.median],
    ['الحد الأدنى', snap.preTest?.min],
    ['الحد الأعلى', snap.preTest?.max],
    ['عدد المحاولات', snap.preTest?.count ?? snap.preTest?.attemptCount],
  ]);

  addKvSheet(wb, '06_الاختبار_البعدي', 'الاختبار البعدي', [
    ['المتوسط', snap.postTest?.average ?? snap.postTest?.score],
    ['الوسيط', snap.postTest?.median],
    ['الحد الأدنى', snap.postTest?.min],
    ['الحد الأعلى', snap.postTest?.max],
    ['حالة الاجتياز', snap.postTest?.passFailStatus],
  ]);

  addKvSheet(wb, '07_التحسن', 'قياس أثر التعلّم', [
    ['فرق النقاط المئوية', snap.learningImprovement?.percentagePointDifference ?? snap.learningImpact?.averagePp],
    ['التحسن النسبي %', snap.learningImprovement?.relativeImprovementPct],
    ['تحسّن', snap.learningImpact?.improved],
    ['ثبات', snap.learningImpact?.unchanged],
    ['انخفاض', snap.learningImpact?.decreased],
    ['ملاحظة', snap.learningImprovement?.note || snap.learningImpact?.caveat],
  ]);

  addKvSheet(
    wb,
    '08_التقييم_النهائي',
    'التقييم النهائي',
    Object.entries(snap.evaluation?.averages || snap.sections || {}).concat([
      ['NPS', snap.nps?.index ?? snap.evaluation?.nps?.index],
      ['مروّجون', snap.nps?.promoters ?? snap.evaluation?.nps?.promoters],
      ['محايدون', snap.nps?.passives ?? snap.evaluation?.nps?.passives],
      ['منتقدون', snap.nps?.detractors ?? snap.evaluation?.nps?.detractors],
    ])
  );

  addKvSheet(wb, '09_التعليقات', 'التعليقات والتوصيات', [
    ['التوصية', snap.recommendation || ''],
    ...(snap.recommendations || []).map((r, i) => [`توصية ${i + 1}`, `${r.finding} → ${r.recommendedAction}`]),
  ]);

  addKvSheet(wb, '10_الإكمال', 'الإكمال', [
    ['نسبة الإكمال', snap.completion?.completionRate ?? snap.completionRate],
    ['مكتمل', snap.completion?.completed ?? snap.counts?.completed],
    ['غير مكتمل', snap.completion?.notCompleted ?? snap.counts?.notCompleted],
    ['منسحب', snap.completion?.withdrawn ?? snap.counts?.withdrawn],
  ]);

  addKvSheet(wb, '11_الشهادات', 'الشهادات', [
    ['صادرة', snap.certificates?.issued],
    ['مؤهل', snap.certificates?.eligible],
    ['غير مؤهل', snap.certificates?.ineligible],
    ['معلّق', snap.certificates?.pending],
    ['ملغى', snap.certificates?.revoked],
  ]);

  if (includeRaw) {
    const ws = wb.addWorksheet('12_البيانات_الخام');
    setupRtl(ws);
    ws.addRow(['مفتاح', 'قيمة']);
    styleHeader(ws, 1, 2);
    const flat = (obj, prefix = '') => {
      const out = [];
      Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flat(v, key));
        else out.push([key, Array.isArray(v) ? JSON.stringify(v) : v]);
      });
      return out;
    };
    flat(snap).slice(0, 2000).forEach((row) => ws.addRow(row));
    ws.columns = [{ width: 40 }, { width: 60 }];
  } else {
    addKvSheet(wb, '12_البيانات_الخام', 'البيانات الخام', [
      ['ملاحظة', 'البيانات الخام متاحة لمسؤولي المؤسسة فقط'],
    ]);
  }

  if (snap.rows?.length) {
    addTableSheet(
      wb,
      'المتدربون_التفصيلي',
      ['الاسم', 'البريد', 'حالة التسجيل', 'حالة الشهادة', 'رقم الشهادة', 'تاريخ الإصدار'],
      snap.rows.map((r) => [r.fullName, r.email, r.enrollmentStatus, r.certificateStatus, r.certificateNumber, r.issuedAt])
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { renderTrainingReportExcel };
