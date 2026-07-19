'use strict';

/**
 * Read-only Phase 3 / Phase 7 verification — no writes.
 */
const { PrismaClient } = require('@prisma/client');

const BATCH = '30b7dca3-7fd6-437c-b0e7-6bdf7479c347';
const prisma = new PrismaClient();

async function main() {
  const paRole = await prisma.roles.findUnique({
    where: { code: 'program_admin' },
    select: { id: true, code: true },
  });
  if (!paRole) {
    console.log(JSON.stringify({ error: 'program_admin role row missing', preconditionOk: false }));
    process.exitCode = 1;
    return;
  }

  const historicalPaLinks = await prisma.user_roles.count({
    where: { role_id: paRole.id },
  });

  const [activePaAnyRows] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT u.id)::int AS c
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.status = 'active' AND r.code = 'program_admin'
  `;

  const [activePaPlusOtherRows] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c FROM (
      SELECT u.id
      FROM users u
      WHERE u.status = 'active'
        AND EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id AND r.code = 'program_admin'
        )
        AND EXISTS (
          SELECT 1 FROM user_roles ur2
          JOIN roles r2 ON r2.id = ur2.role_id
          WHERE ur2.user_id = u.id AND r2.code <> 'program_admin'
        )
    ) t
  `;

  const [auditRows] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c FROM audit_logs
    WHERE action_type = 'MAINTENANCE_PROGRAM_ADMIN_DEACTIVATE'
      AND (
        COALESCE(new_values::text, '') LIKE ${'%' + BATCH + '%'}
        OR COALESCE(old_values::text, '') LIKE ${'%' + BATCH + '%'}
      )
  `;

  const [inactivePaHoldersRows] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT u.id)::int AS c
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.status = 'inactive' AND r.code = 'program_admin'
  `;

  const activePaAny = activePaAnyRows.c;
  const activePaPlusOther = activePaPlusOtherRows.c;
  const batchAuditCount = auditRows.c;
  const inactivePaHolders = inactivePaHoldersRows.c;

  const result = {
    paRolePresent: true,
    historicalPaLinks,
    activePaAny,
    activePaPlusOther,
    inactivePaHolders,
    batchAuditCount,
    preconditionOk:
      activePaAny === 0 &&
      activePaPlusOther === 0 &&
      historicalPaLinks >= 2 &&
      batchAuditCount >= 2,
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(String(err && err.message ? err.message : err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
