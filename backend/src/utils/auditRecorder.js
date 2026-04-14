const { recordAudit: recordAuditEntry } = require('../shared/services/audit.service');

/**
 * Record an audit log row (internal use from services / future hooks).
 * @param {{
 *   userId?: string | null,
 *   universityId?: string | null,
 *   actionType: string,
 *   entityType: string,
 *   entityId?: string | null,
 *   oldValues?: unknown,
 *   newValues?: unknown,
 *   ipAddress?: string | null,
 * }} payload
 */
async function recordAudit(payload) {
  return recordAuditEntry(payload);
}

module.exports = { recordAudit };
