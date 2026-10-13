const auditLogsService = require('./auditLogs.service');
const { success } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await auditLogsService.listAuditLogs(req.validated.query, req.user);
    return success(res, data, { message: 'Audit logs retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await auditLogsService.getAuditLogById(req.validated.params.id, req.user);
    return success(res, data, { message: 'Audit log retrieved' });
  } catch (e) {
    return next(e);
  }
}

function catalog(_req, res) {
  return success(res, auditLogsService.getAuditCatalog(), { message: 'Audit catalog retrieved' });
}

async function studentTimeline(req, res, next) {
  try {
    const data = await auditLogsService.getStudentTimeline(
      req.validated.params.studentId,
      req.validated.query,
      req.user
    );
    return success(res, data, { message: 'Student activity retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function userSessions(req, res, next) {
  try {
    const data = await auditLogsService.listUserSessions(req.validated.params.userId, req.user);
    return success(res, data, { message: 'Sessions retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function revokeSession(req, res, next) {
  try {
    const data = await auditLogsService.revokeSession(req.validated.params.id, req.user);
    return success(res, data, { message: 'تم إنهاء الجلسة.' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, catalog, studentTimeline, userSessions, revokeSession };
