'use strict';
/**
 * PROD-DRIFT-OPTION-B-001 — guarded checksum reconciliation.
 * Updates ONLY checksum for the exact migration row.
 * Does NOT execute ADD COLUMN SQL.
 */
require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const {
  assertRecoveryAuthorization,
  assertProductionDatabaseUrl,
} = require('./lib/reconcileChecksumGuards');

const OLD = 'c43e180b0cf7cd45c1eb65ccbfe10710b13e8c577d35dfcf0087508b16ad3b65';
const NEW_EXPECTED = '411b2fe3ab1cb904fc67e0503d132556a97812bc1705bd6906ec724ac25c91b2';
const NAME = '20260719120000_field_training_required_hours';
const migPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  NAME,
  'migration.sql'
);

function loadNewChecksum() {
  const fileBuf = fs.readFileSync(migPath);
  if (fileBuf.includes(0x0d)) throw new Error('migration.sql must be LF-only');
  if (fileBuf[0] === 0xef && fileBuf[1] === 0xbb && fileBuf[2] === 0xbf) {
    throw new Error('migration.sql must not have BOM');
  }
  const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
  if (hash !== NEW_EXPECTED) {
    throw new Error(`Canonical migration checksum mismatch: expected ${NEW_EXPECTED}, got ${hash}`);
  }
  if (hash === OLD) throw new Error('New checksum unexpectedly equals old checksum');
  return hash;
}

async function assertPreWriteState(tx) {
  const migRows = await tx.$queryRaw`
    SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count, logs
    FROM _prisma_migrations
    WHERE migration_name = ${NAME}
    FOR UPDATE`;
  if (migRows.length !== 1) {
    throw new Error(`Expected 1 locked row, got ${migRows.length}`);
  }

  const before = migRows[0];
  if (before.checksum !== OLD) throw new Error('Pre-update checksum mismatch');
  if (before.finished_at == null) throw new Error('finished_at is null');
  if (before.rolled_back_at != null) throw new Error('rolled_back_at is set');
  if (Number(before.applied_steps_count) !== 1) throw new Error('applied_steps_count != 1');

  const applied = await tx.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const failed = await tx.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM _prisma_migrations
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`;
  if (applied[0].c !== 28) throw new Error(`Expected 28 applied migrations, got ${applied[0].c}`);
  if (failed[0].c !== 0) throw new Error(`Expected 0 failed migrations, got ${failed[0].c}`);

  const col = await tx.$queryRaw`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'field_training_opportunities'
      AND column_name = 'required_training_hours'`;
  if (col.length !== 1) throw new Error('required_training_hours column missing');
  if (col[0].data_type !== 'integer') throw new Error('column type is not integer');
  if (col[0].is_nullable !== 'YES') throw new Error('column is not nullable');
  if (col[0].column_default != null) throw new Error('column has unexpected default');

  const idx = await tx.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'field_training_opportunities'
      AND indexdef ILIKE '%required_training_hours%'`;
  if (idx[0].c !== 0) throw new Error('unexpected index on required_training_hours');

  return before;
}

async function runReconciliation() {
  const recovery = assertRecoveryAuthorization(process.env);
  assertProductionDatabaseUrl(process.env.DATABASE_URL);
  const NEW = loadNewChecksum();

  const p = new PrismaClient();
  try {
    const result = await p.$transaction(async (tx) => {
      const before = await assertPreWriteState(tx);

      const updated = await tx.$executeRaw`
        UPDATE _prisma_migrations
        SET checksum = ${NEW}
        WHERE migration_name = ${NAME}
          AND checksum = ${OLD}
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
          AND applied_steps_count = 1`;
      if (updated !== 1) {
        throw new Error(`Update count ${updated} != 1 — rolling back`);
      }

      const afterRows = await tx.$queryRaw`
        SELECT migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count, logs
        FROM _prisma_migrations
        WHERE migration_name = ${NAME}`;
      const after = afterRows[0];
      if (after.checksum !== NEW) throw new Error('Post-update checksum mismatch');
      if (after.migration_name !== before.migration_name) throw new Error('name changed');
      if (String(after.started_at) !== String(before.started_at)) throw new Error('started_at changed');
      if (String(after.finished_at) !== String(before.finished_at)) throw new Error('finished_at changed');
      if (after.rolled_back_at !== before.rolled_back_at) throw new Error('rolled_back_at changed');
      if (Number(after.applied_steps_count) !== Number(before.applied_steps_count)) {
        throw new Error('applied_steps_count changed');
      }
      if (after.logs !== before.logs) throw new Error('logs changed');

      return {
        recoveryMode: recovery.mode,
        ownerAcceptedNoRecovery: recovery.ownerAcceptedNoRecovery,
        recoveryRef: recovery.recoveryRef,
        oldChecksum: OLD,
        newChecksum: NEW,
        newChecksumShort: NEW.slice(0, 12),
        updatedRows: updated,
        onlyChecksumChanged: true,
      };
    });

    return { ok: true, ...result };
  } finally {
    await p.$disconnect();
  }
}

async function main() {
  const result = await runReconciliation();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  });
}

module.exports = {
  OLD,
  NEW_EXPECTED,
  NAME,
  loadNewChecksum,
  runReconciliation,
};
