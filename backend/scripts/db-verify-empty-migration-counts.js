/**
 * CI-EMPTY-DB-MIGRATION-COUNT-001 — Verify empty-DB migration counts after
 * `db:init-empty` (baseline resolve + migrate deploy).
 *
 * Distinguishes:
 *   baseline represented (manifest) vs repository dirs vs final applied rows.
 *
 * Read-only against DATABASE_URL. Never prints credentials.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  loadManifest,
  validateBaselineManifest,
  listValidMigrationDirs,
  evaluateEmptyDbMigrationCounts,
  redactSecretsFromMessage,
} = require('./lib/baselineManifest');

const backendRoot = path.join(__dirname, '..');
const baselinesDir = path.join(backendRoot, 'prisma', 'baselines');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');

function activeManifestPath() {
  const version = (process.env.EMPTY_DB_BASELINE_VERSION || 'v1').trim();
  return path.join(baselinesDir, `empty_init_${version}.manifest.json`);
}

async function main() {
  const manifest = loadManifest(activeManifestPath());
  const validation = validateBaselineManifest({
    manifest,
    baselinesDir,
    migrationsDir,
    schemaPath,
    schemaMismatchPolicy: process.env.BASELINE_REQUIRE_SCHEMA_MATCH === 'true' ? 'error' : 'warn',
  });

  const baselineRepresentedCount = validation.migrationsToResolve.length;
  const repositoryNames = listValidMigrationDirs(migrationsDir);
  const repositoryMigrationCount = repositoryNames.length;

  const prisma = new PrismaClient();
  try {
    const appliedRows = await prisma.$queryRawUnsafe(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `);
    const failedRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c FROM "_prisma_migrations"
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `);

    const appliedNames = appliedRows.map((r) => String(r.migration_name));
    const appliedSet = new Set(appliedNames);
    const pendingNames = repositoryNames.filter((n) => !appliedSet.has(n));

    const result = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount,
      repositoryMigrationCount,
      finalAppliedMigrationCount: appliedNames.length,
      pendingCount: pendingNames.length,
      failedCount: failedRows[0].c,
      expectedBaselineRepresentedCount: 27,
      expectedCutoff: '20260718120000_academic_submission_uniqueness',
      actualCutoff: validation.cutoff || manifest.lastMigration,
      appliedMigrationNames: appliedNames,
      repositoryMigrationNames: repositoryNames,
    });

    console.log('Baseline represented migrations:', result.summary.baseline_represented_migrations);
    console.log('Repository migration directories:', result.summary.repository_migration_directories);
    console.log('Post-cutoff migrations:', result.summary.post_cutoff_migrations);
    console.log('Final applied migrations:', result.summary.final_applied_migrations);
    console.log('Pending migrations:', result.summary.pending_migrations);
    console.log('Failed migrations:', result.summary.failed_migrations);

    if (!result.ok) {
      for (const err of result.errors) {
        console.error(`[db:verify-empty-migration-counts] FAIL: ${err}`);
      }
      process.exit(1);
    }

    console.log('Empty database migration verification: PASS');
    console.log(JSON.stringify({ ok: true, ...result.summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`[db:verify-empty-migration-counts] ${redactSecretsFromMessage(e.message || e)}`);
  process.exit(1);
});
