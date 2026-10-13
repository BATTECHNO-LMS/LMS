'use strict';

/**
 * Capture audit rows in memory (no database). Also stubs the tenant lookups used by
 * `recordAudit` so unit tests never touch Postgres.
 */
function installAuditCapture() {
  const { prisma } = require('../../src/config/db');
  const { clearAuditTenantCacheForTests } = require('../../src/shared/services/audit.service');
  const rows = [];
  const originals = {
    create: prisma.audit_logs.create,
    createMany: prisma.audit_logs.createMany,
    usersFindUnique: prisma.users.findUnique,
  };
  prisma.audit_logs.create = async ({ data }) => {
    const row = { id: `audit-${rows.length + 1}`, created_at: new Date(), ...data };
    rows.push(row);
    return row;
  };
  prisma.audit_logs.createMany = async ({ data }) => {
    for (const d of data) rows.push({ id: `audit-${rows.length + 1}`, created_at: new Date(), ...d });
    return { count: data.length };
  };
  prisma.users.findUnique = async () => null;
  clearAuditTenantCacheForTests();
  return {
    rows,
    byAction(action) {
      return rows.filter((r) => r.action_type === action);
    },
    clear() {
      rows.length = 0;
    },
    restore() {
      prisma.audit_logs.create = originals.create;
      prisma.audit_logs.createMany = originals.createMany;
      prisma.users.findUnique = originals.usersFindUnique;
      clearAuditTenantCacheForTests();
    },
  };
}

module.exports = { installAuditCapture };
