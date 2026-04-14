const reportsService = require('./reports.service');
const { success } = require('../../utils/apiResponse');
const { recordAudit } = require('../../shared/services/audit.service');
const { normalizeRoles } = require('../../utils/deliveryAccess');

function scopeFiltersForUser(query, user) {
  const roles = normalizeRoles(user?.roles || []);
  const isSystemWide = roles.includes('super_admin') || roles.includes('program_admin');
  if (isSystemWide) return query;
  if (user?.universityId) {
    return { ...query, university_id: user.universityId };
  }
  return query;
}

async function auditReportRead(req, reportType, summary) {
  await recordAudit({
    userId: req.user?.userId ?? null,
    universityId: req.user?.universityId ?? null,
    actionType: 'report.read',
    entityType: 'report',
    entityId: null,
    newValues: { report_type: reportType, summary },
    ipAddress: req.ip || null,
  });
}

async function universities(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('universities', scopedQuery);
    await auditReportRead(req, 'universities', data.summary);
    return success(res, data, { message: 'Universities report generated' });
  } catch (e) {
    return next(e);
  }
}

async function cohorts(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('cohorts', scopedQuery);
    await auditReportRead(req, 'cohorts', data.summary);
    return success(res, data, { message: 'Cohorts report generated' });
  } catch (e) {
    return next(e);
  }
}

async function attendance(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('attendance', scopedQuery);
    await auditReportRead(req, 'attendance', data.summary);
    return success(res, data, { message: 'Attendance report generated' });
  } catch (e) {
    return next(e);
  }
}

async function assessments(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('assessments', scopedQuery);
    await auditReportRead(req, 'assessments', data.summary);
    return success(res, data, { message: 'Assessments report generated' });
  } catch (e) {
    return next(e);
  }
}

async function recognition(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('recognition', scopedQuery);
    await auditReportRead(req, 'recognition', data.summary);
    return success(res, data, { message: 'Recognition report generated' });
  } catch (e) {
    return next(e);
  }
}

async function certificates(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.getReportByType('certificates', scopedQuery);
    await auditReportRead(req, 'certificates', data.summary);
    return success(res, data, { message: 'Certificates report generated' });
  } catch (e) {
    return next(e);
  }
}

async function exportByType(req, res, next) {
  try {
    const scopedQuery = scopeFiltersForUser(req.validated.query, req.user);
    const data = await reportsService.exportReport(req.validated.params.type, scopedQuery.format, scopedQuery);
    await recordAudit({
      userId: req.user?.userId ?? null,
      universityId: req.user?.universityId ?? null,
      actionType: 'report.export',
      entityType: 'report',
      entityId: null,
      newValues: { report_type: req.validated.params.type, format: req.validated.query.format },
      ipAddress: req.ip || null,
    });
    if (data.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
      return res.status(200).send(data.content);
    }
    return success(res, data.content, { message: 'JSON report export generated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  universities,
  cohorts,
  attendance,
  assessments,
  recognition,
  certificates,
  exportByType,
};
