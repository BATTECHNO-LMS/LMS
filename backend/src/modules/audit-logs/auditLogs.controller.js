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

module.exports = { list, getById };
