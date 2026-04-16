import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const KPI_KEYS = [
  'universities',
  'microCredentials',
  'activeCohorts',
  'enrolledStudents',
  'attendanceRatePct',
  'delayedAssessments',
  'missingEvidence',
  'recognitionReady',
  'openQaIssues',
  'openIntegrityCases',
  'certificatesIssued',
  'activeUsers',
];

const KPI_I18N_PATH = {
  universities: 'kpi.universities',
  microCredentials: 'kpi.microCredentials',
  activeCohorts: 'kpi.activeCohorts',
  enrolledStudents: 'kpi.enrolledStudents',
  attendanceRatePct: 'kpi.attendanceRate',
  delayedAssessments: 'kpi.delayedAssessments',
  missingEvidence: 'kpi.missingEvidence',
  recognitionReady: 'kpi.recognitionReady',
  openQaIssues: 'kpi.openQa',
  openIntegrityCases: 'kpi.openIntegrity',
  certificatesIssued: 'kpi.certificatesIssued',
  activeUsers: 'kpi.activeUsers',
};

/** English KPI names for PDF (Helvetica has limited Unicode). */
const KPI_LABEL_EN = {
  universities: 'Universities',
  microCredentials: 'Micro-credentials',
  activeCohorts: 'Active cohorts',
  enrolledStudents: 'Enrolled students',
  attendanceRatePct: 'Attendance rate %',
  delayedAssessments: 'Delayed assessments',
  missingEvidence: 'Missing evidence',
  recognitionReady: 'Recognition ready',
  openQaIssues: 'Open QA issues',
  openIntegrityCases: 'Open integrity cases',
  certificatesIssued: 'Certificates issued',
  activeUsers: 'Active users',
};

function resolveApiBase() {
  const b = import.meta.env.VITE_API_BASE_URL ?? '';
  if (b) return String(b).replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sheetFromJson(rows, emptyMessage) {
  if (!rows?.length) return XLSX.utils.aoa_to_sheet([[emptyMessage]]);
  return XLSX.utils.json_to_sheet(rows);
}

function buildWorkbook(data, filters, t) {
  const wb = XLSX.utils.book_new();
  const kpis = data?.kpis ?? {};

  const kpiRows = KPI_KEYS.map((key) => ({
    metric: t(KPI_I18N_PATH[key]),
    value: key === 'attendanceRatePct' ? `${kpis[key] ?? 0}%` : kpis[key] ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromJson(kpiRows, t('export.emptySheet')), 'KPIs');

  const uni = (data?.universitiesOverview ?? []).map((u) => ({
    id: u.id,
    name: u.nameAr ?? u.nameEn ?? u.label ?? '',
    cohorts: u.cohorts,
    students: u.students,
    recognitionRequests: u.recognitionRequests,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromJson(uni, t('export.emptySheet')), 'Universities');

  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.enrollmentGrowth ?? [], t('export.emptySheet')), 'Enrollment');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.cohortStatus ?? [], t('export.emptySheet')), 'CohortStatus');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.assessmentHealth ?? [], t('export.emptySheet')), 'Assessments');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.attendanceTrend ?? [], t('export.emptySheet')), 'Attendance');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.evidenceAnalytics ?? [], t('export.emptySheet')), 'Evidence');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.qaIntegrityBar ?? [], t('export.emptySheet')), 'QA_Integrity');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.recognitionFunnel ?? [], t('export.emptySheet')), 'Recognition');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.certificatesByMonth ?? [], t('export.emptySheet')), 'Cert_Months');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.certificatesByUniversity ?? [], t('export.emptySheet')), 'Cert_Uni');
  XLSX.utils.book_append_sheet(wb, sheetFromJson(data?.certificatesByCredential ?? [], t('export.emptySheet')), 'Cert_MC');

  const filterRows = [
    { field: t('filters.university'), value: filters.universityId || t('filters.all') },
    { field: t('filters.track'), value: filters.trackId || t('filters.all') },
    { field: t('filters.microCredential'), value: filters.microCredentialId || t('filters.all') },
    { field: t('filters.cohort'), value: filters.cohortId || t('filters.all') },
    { field: t('filters.from'), value: filters.from || '—' },
    { field: t('filters.to'), value: filters.to || '—' },
    { field: t('filters.timeRange'), value: t(`filters.presets.${filters.timePreset || 'last30'}`) },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterRows), 'Filters');

  return wb;
}

function appendPowerBiReadmeSheet(wb, filters, t) {
  const base = resolveApiBase();
  const apiPath = `${base}/api/${import.meta.env.VITE_API_VERSION || 'v1'}/analytics/overview`;
  const qs = new URLSearchParams();
  if (filters.universityId) qs.set('university_id', filters.universityId);
  if (filters.trackId) qs.set('track_id', filters.trackId);
  if (filters.microCredentialId) qs.set('micro_credential_id', filters.microCredentialId);
  if (filters.cohortId) qs.set('cohort_id', filters.cohortId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  const q = qs.toString();
  const rows = [
    [t('export.powerBi.title')],
    [t('export.powerBi.step1')],
    [t('export.powerBi.step2')],
    [''],
    [t('export.powerBi.apiLabel'), apiPath + (q ? `?${q}` : '')],
    [''],
    [t('export.powerBi.authNote')],
    [new Date().toISOString()],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'PowerBI');
}

/**
 * @param {{ data: object; filters: object; t: (k: string, o?: object) => string }} params
 */
export function exportAnalyticsExcel({ data, filters, t }) {
  const wb = buildWorkbook(data, filters, t);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `lms-analytics-${stamp}.xlsx`);
}

/**
 * Same tables as Excel + PowerBI sheet with import / API hints.
 * @param {{ data: object; filters: object; t: (k: string, o?: object) => string }} params
 */
export function exportAnalyticsPowerBi({ data, filters, t }) {
  const wb = buildWorkbook(data, filters, t);
  appendPowerBiReadmeSheet(wb, filters, t);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `lms-analytics-powerbi-${stamp}.xlsx`);
}

/**
 * @param {{ data: object; filters: object; t: (k: string, o?: object) => string }} params
 */
export function exportAnalyticsPdf({ data, filters, t }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const kpis = data?.kpis ?? {};
  const title = t('page.title');

  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(String(title), 180);
  doc.text(titleLines, 14, 14);
  const yAfterTitle = 14 + titleLines.length * 7;
  doc.setFontSize(9);
  doc.text(`${t('filters.timeRange')}: ${t(`filters.presets.${filters.timePreset || 'last30'}`)}`, 14, yAfterTitle + 2);
  doc.text(`${t('filters.from')}: ${filters.from || '—'}  ${t('filters.to')}: ${filters.to || '—'}`, 14, yAfterTitle + 8);

  const kpiBody = KPI_KEYS.map((key) => {
    const label = KPI_LABEL_EN[key];
    const val = key === 'attendanceRatePct' ? `${kpis[key] ?? 0}%` : String(kpis[key] ?? 0);
    return [label, val];
  });

  autoTable(doc, {
    startY: yAfterTitle + 14,
    head: [['KPI', 'Value']],
    body: kpiBody,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [106, 115, 250] },
  });

  const lastY = doc.lastAutoTable?.finalY ?? 50;
  let nextY = lastY + 10;
  if (nextY > 250) {
    doc.addPage();
    nextY = 16;
  }
  doc.setFontSize(11);
  const uniTitleLines = doc.splitTextToSize(String(t('charts.universitiesOverview.title')), 180);
  doc.text(uniTitleLines, 14, nextY);
  nextY += uniTitleLines.length * 5 + 2;

  const uniRows = (data?.universitiesOverview ?? []).slice(0, 25).map((u) => [
    String(u.nameEn ?? u.nameAr ?? u.label ?? u.id ?? ''),
    String(u.cohorts ?? ''),
    String(u.students ?? ''),
    String(u.recognitionRequests ?? ''),
  ]);

  autoTable(doc, {
    startY: nextY,
    head: [['University', 'Cohorts', 'Students', 'Recognition']],
    body: uniRows.length ? uniRows : [['—', '0', '0', '0']],
    styles: { fontSize: 7 },
    headStyles: { fillColor: [106, 115, 250] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`TECHNO LMS · ${new Date().toISOString().slice(0, 10)} · ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 8);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  doc.save(`lms-analytics-${stamp}.pdf`);
}
