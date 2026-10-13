const auditService = require('../shared/services/audit.service');

/**
 * Record an audit log row (internal use from services / future hooks).
 * See shared/services/audit.service.js for payload fields and the failure policy.
 */
async function recordAudit(payload, options) {
  return auditService.recordAudit(payload, options);
}

async function recordAuditMany(payloads, options) {
  return auditService.recordAuditMany(payloads, options);
}

module.exports = { recordAudit, recordAuditMany };
