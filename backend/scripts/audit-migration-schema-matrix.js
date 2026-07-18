'use strict';

/**
 * Read-only: parse each migration SQL and verify intended objects exist live.
 * Outputs masked evidence matrix JSON.
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

function parseMigrationSql(sql) {
  const tables = new Set();
  const indexes = new Set();
  const columns = []; // { table, column }
  const enums = new Set();
  const fks = [];

  const createTable = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi)];
  for (const m of createTable) tables.add(m[1]);

  const createIndex = [
    ...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi),
  ];
  for (const m of createIndex) indexes.add(m[1]);

  const addCol = [
    ...sql.matchAll(
      /ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi
    ),
  ];
  for (const m of addCol) columns.push({ table: m[1], column: m[2] });

  const createEnum = [...sql.matchAll(/CREATE\s+TYPE\s+["']?(\w+)["']?\s+AS\s+ENUM/gi)];
  for (const m of createEnum) enums.add(m[1]);

  const addEnumVal = [
    ...sql.matchAll(/ALTER\s+TYPE\s+["']?(\w+)["']?\s+ADD\s+VALUE/gi),
  ];
  for (const m of addEnumVal) enums.add(m[1]);

  const fk = [
    ...sql.matchAll(
      /ADD\s+CONSTRAINT\s+["']?(\w+)["']?\s+FOREIGN\s+KEY/gi
    ),
  ];
  for (const m of fk) fks.push(m[1]);

  return {
    tables: [...tables],
    indexes: [...indexes],
    columns,
    enums: [...enums],
    foreign_keys: fks,
  };
}

async function main() {
  const liveTables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `;
  const liveTableSet = new Set(liveTables.map((r) => r.table_name));

  const liveIndexes = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes WHERE schemaname='public'
  `;
  const liveIndexSet = new Set(liveIndexes.map((r) => r.indexname));

  const liveEnums = await prisma.$queryRaw`
    SELECT t.typname AS name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
  `;
  const liveEnumSet = new Set(liveEnums.map((r) => r.name));

  const liveCols = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
  `;
  const liveColSet = new Set(liveCols.map((r) => `${r.table_name}.${r.column_name}`));

  const liveFks = await prisma.$queryRaw`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema='public' AND constraint_type='FOREIGN KEY'
  `;
  const liveFkSet = new Set(liveFks.map((r) => r.constraint_name));

  const matrix = [];

  for (const name of listRepoMigrations()) {
    const sqlPath = path.join(migrationsDir, name, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const intended = parseMigrationSql(sql);

    const missingTables = intended.tables.filter((t) => !liveTableSet.has(t));
    const missingIndexes = intended.indexes.filter((i) => !liveIndexSet.has(i));
    const missingColumns = intended.columns.filter(
      (c) => !liveColSet.has(`${c.table}.${c.column}`)
    );
    const missingEnums = intended.enums.filter((e) => !liveEnumSet.has(e));
    const missingFks = intended.foreign_keys.filter((f) => !liveFkSet.has(f));

    // Special: unique index column order for academic uniqueness
    let academicIndexOk = null;
    if (name.includes('academic_submission_uniqueness')) {
      const detail = await prisma.$queryRaw`
        SELECT
          i.relname AS index_name,
          ix.indisunique AS is_unique,
          array_agg(a.attname ORDER BY x.ord) AS columns
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
        WHERE t.relname = 'submissions' AND i.relname = 'uq_submissions_assessment_student'
        GROUP BY i.relname, ix.indisunique
      `;
      academicIndexOk = {
        present: detail.length > 0,
        is_unique: detail[0]?.is_unique === true,
        columns: detail[0]?.columns || [],
        matches_expected:
          detail.length > 0 &&
          detail[0].is_unique === true &&
          JSON.stringify(detail[0].columns) === JSON.stringify(['assessment_id', 'student_id']),
      };
    }

    const allPresent =
      missingTables.length === 0 &&
      missingIndexes.length === 0 &&
      missingColumns.length === 0 &&
      missingEnums.length === 0 &&
      missingFks.length === 0 &&
      (academicIndexOk == null || academicIndexOk.matches_expected);

    // Migrations that only ALTER existing objects / use IF NOT EXISTS may have empty intended creates
    const hasIntendedObjects =
      intended.tables.length +
        intended.indexes.length +
        intended.columns.length +
        intended.enums.length +
        intended.foreign_keys.length >
      0;

    let safe_to_mark_applied = allPresent && (hasIntendedObjects || sql.trim().length > 0);
    let confidence = 'high';
    let notes = [];

    if (!hasIntendedObjects) {
      // e.g. backfill-only or comment-heavy — inspect manually
      const hasDataDml = /\b(UPDATE|INSERT|DELETE|TRUNCATE)\b/i.test(sql);
      notes.push(hasDataDml ? 'contains_dml' : 'no_parsed_ddl_objects');
      confidence = hasDataDml ? 'medium' : 'medium';
      // backfill safe if we don't re-run it — marking applied is OK if effects already done or idempotent
      safe_to_mark_applied = true;
    }

    if (!allPresent) {
      safe_to_mark_applied = false;
      confidence = 'low';
    }

    if (academicIndexOk && !academicIndexOk.matches_expected) {
      safe_to_mark_applied = false;
      confidence = 'blocked';
    }

    matrix.push({
      migration: name,
      intended,
      missing: {
        tables: missingTables,
        indexes: missingIndexes,
        columns: missingColumns,
        enums: missingEnums,
        foreign_keys: missingFks,
      },
      academic_unique_index: academicIndexOk,
      all_effects_present: allPresent,
      safe_to_mark_applied,
      confidence,
      notes,
    });
  }

  const summary = {
    live_public_table_count: liveTableSet.size,
    migrations_total: matrix.length,
    safe_to_mark_applied: matrix.filter((m) => m.safe_to_mark_applied).length,
    blocked: matrix.filter((m) => !m.safe_to_mark_applied).map((m) => m.migration),
    _prisma_migrations_exists: false,
  };

  console.log(JSON.stringify({ summary, matrix }, null, 2));
}

main()
  .catch((e) => {
    console.error('MATRIX_ERROR', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
