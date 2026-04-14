const { prisma } = require('../../config/db');

/**
 * Persist an audit log row (internal service helper).
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
  return prisma.audit_logs.create({
    data: {
      user_id: payload.userId ?? null,
      university_id: payload.universityId ?? null,
      action_type: payload.actionType,
      entity_type: payload.entityType,
      entity_id: payload.entityId ?? null,
      old_values: payload.oldValues ?? undefined,
      new_values: payload.newValues ?? undefined,
      ip_address: payload.ipAddress ?? null,
    },
  });
}

module.exports = {
  recordAudit,
};
