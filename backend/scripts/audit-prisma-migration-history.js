'use strict';

/**
 * Read-only Prisma migration history + schema presence audit.
 * No writes. Masked output only — no credentials, no PII.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

function listRepoMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

async function main() {
  const repo = listRepoMigrations();

  const tableExists = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS exists
  `;

  const hasMigrationsTable = Boolean(tableExists[0]?.exists);

  let history = [];
  if (hasMigrationsTable) {
    history = await prisma.$queryRaw`
      SELECT
        migration_name,
        finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolled_back,
        started_at,
        finished_at,
        applied_steps_count,
        LENGTH(checksum) AS checksum_len,
        CASE WHEN logs IS NULL THEN false ELSE length(logs) > 0 END AS has_logs
      FROM _prisma_migrations
      ORDER BY started_at ASC NULLS LAST, migration_name ASC
    `;
  }

  const appliedNames = new Set(history.filter((h) => h.finished && !h.rolled_back).map((h) => h.migration_name));
  const failedOrIncomplete = history.filter((h) => !h.finished || h.rolled_back);

  const inRepoNotHistory = repo.filter((m) => !appliedNames.has(m));
  const inHistoryNotRepo = [...appliedNames].filter((m) => !repo.includes(m));

  // Key schema presence probes (additive evidence, no data)
  const schemaProbes = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS public_table_count,
      (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')) AS has_users,
      (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='submissions')) AS has_submissions,
      (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='grades')) AS has_grades,
      (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assessments')) AS has_assessments,
      (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='field_training_opportunities')) AS has_ft_opportunities,
      (SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_submissions_assessment_student')) AS has_uq_submissions_assessment_student,
      (SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_enrollments')) AS has_uq_enrollments,
      (SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_grades')) AS has_uq_grades
  `;

  const indexDetail = await prisma.$queryRaw`
    SELECT
      i.relname AS index_name,
      ix.indisunique AS is_unique,
      array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relkind = 'r'
      AND t.relname = 'submissions'
      AND i.relname = 'uq_submissions_assessment_student'
    GROUP BY i.relname, ix.indisunique
  `;

  const report = {
    _prisma_migrations_exists: hasMigrationsTable,
    history_row_count: history.length,
    finished_applied_count: appliedNames.size,
    failed_or_incomplete_count: failedOrIncomplete.length,
    failed_or_incomplete: failedOrIncomplete.map((h) => ({
      migration_name: h.migration_name,
      finished: h.finished,
      rolled_back: h.rolled_back,
      applied_steps_count: h.applied_steps_count,
      has_logs: h.has_logs,
    })),
    repo_migration_count: repo.length,
    repo_migrations: repo,
    applied_migration_names: [...appliedNames].sort(),
    in_repo_not_in_history: inRepoNotHistory,
    in_history_not_in_repo: inHistoryNotRepo,
    schema_probes: schemaProbes[0],
    academic_unique_index: indexDetail[0] || null,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error('AUDIT_ERROR', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
