const repo = require('./reports.repository');
const { ApiError } = require('../../utils/apiError');

const REPORT_TYPES = new Set(['universities', 'cohorts', 'attendance', 'assessments', 'recognition', 'certificates']);

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => esc(row[c])).join(','));
  }
  return lines.join('\n');
}

function summarizeAttendanceRows(rows) {
  const low = rows.filter((r) => Number(r.attendance_percentage || 0) < 75).length;
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + Number(r.attendance_percentage || 0), 0) / rows.length) * 100) / 100 : 0;
  return { total_rows: rows.length, low_attendance_rows: low, average_attendance_pct: avg };
}

function summarizeAssessmentsRows(rows) {
  const passRows = rows.filter((r) => Number(r.average_score || 0) >= 60).length;
  const overdue = rows.filter((r) => new Date(r.due_date) < new Date() && ['open', 'published'].includes(r.status)).length;
  return { total_rows: rows.length, pass_rows: passRows, overdue_rows: overdue };
}

function summarizeRecognitionRows(rows) {
  const byStatus = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  const ready = rows.filter((r) => r.has_credential_description && r.has_alignment_matrix).length;
  return { total_rows: rows.length, by_status: byStatus, ready_documents_rows: ready };
}

function summarizeCertificatesRows(rows) {
  const issued = rows.filter((r) => r.status === 'issued').length;
  const byUniversity = {};
  for (const row of rows) {
    const key = row.university_id || 'unknown';
    byUniversity[key] = (byUniversity[key] || 0) + 1;
  }
  return { total_rows: rows.length, issued_rows: issued, by_university: byUniversity };
}

async function getReportByType(type, filters) {
  if (!REPORT_TYPES.has(type)) throw new ApiError(400, 'Unsupported report type');
  if (type === 'universities') {
    const rows = await repo.universitiesReport(filters);
    return { report_type: type, summary: { total_rows: rows.length }, rows };
  }
  if (type === 'cohorts') {
    const rows = await repo.cohortsReport(filters);
    return { report_type: type, summary: { total_rows: rows.length }, rows };
  }
  if (type === 'attendance') {
    const rows = await repo.attendanceReport(filters);
    return { report_type: type, summary: summarizeAttendanceRows(rows), rows };
  }
  if (type === 'assessments') {
    const rows = await repo.assessmentsReport(filters);
    return { report_type: type, summary: summarizeAssessmentsRows(rows), rows };
  }
  if (type === 'recognition') {
    const rows = await repo.recognitionReport(filters);
    return { report_type: type, summary: summarizeRecognitionRows(rows), rows };
  }
  const rows = await repo.certificatesReport(filters);
  return { report_type: type, summary: summarizeCertificatesRows(rows), rows };
}

async function exportReport(type, format, filters) {
  const base = await getReportByType(type, filters);
  if (format === 'json') return { format, content: base };
  if (format === 'csv') return { format, content: toCsv(base.rows), filename: `${type}-report.csv` };
  throw new ApiError(400, 'Unsupported export format');
}

module.exports = {
  getReportByType,
  exportReport,
};
