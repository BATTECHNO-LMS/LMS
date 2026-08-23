'use strict';

/**
 * Read-only DB latency / size probe. Does not print connection strings, emails, or tokens.
 * Usage: node scripts/measure-db-performance.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { summarizeDatabaseHost } = require('../src/config/prismaPoolUrl');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((s, n) => s + n, 0);
  return {
    n: sorted.length,
    min: Math.round(sorted[0] * 10) / 10,
    median: Math.round(percentile(sorted, 50) * 10) / 10,
    avg: Math.round((sum / sorted.length) * 10) / 10,
    p95: Math.round(percentile(sorted, 95) * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
  };
}

async function timeSelect1(rounds = 10) {
  const samples = [];
  await prisma.$queryRaw`SELECT 1`;
  for (let i = 0; i < rounds; i += 1) {
    const t0 = process.hrtime.bigint();
    await prisma.$queryRaw`SELECT 1`;
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return samples;
}

async function tableOverview() {
  const rows = await prisma.$queryRaw`
    SELECT
      c.relname AS table_name,
      COALESCE(s.n_live_tup, 0)::bigint AS approx_rows,
      pg_total_relation_size(c.oid)::bigint AS total_bytes,
      pg_indexes_size(c.oid)::bigint AS index_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
        'users',
        'training_programs',
        'training_enrollments',
        'training_sessions',
        'training_attendance_records',
        'training_tasks',
        'training_task_submissions',
        'training_assessments',
        'training_assessment_attempts',
        'field_training_applications',
        'notifications',
        'audit_logs',
        'qa_reviews',
        'corrective_actions',
        'risk_cases',
        'integrity_cases',
        'recognition_requests'
      )
    ORDER BY pg_total_relation_size(c.oid) DESC
  `;
  return rows.map((r) => ({
    table: r.table_name,
    approx_rows: Number(r.approx_rows),
    table_mb: Math.round((Number(r.total_bytes) / 1024 / 1024) * 100) / 100,
    index_mb: Math.round((Number(r.index_bytes) / 1024 / 1024) * 100) / 100,
  }));
}

async function main() {
  const connection = summarizeDatabaseHost(process.env.DATABASE_URL || '');
  const select1 = await timeSelect1(10);
  const tables = await tableOverview();
  process.stdout.write(`${JSON.stringify({ measured_at: new Date().toISOString(), connection, select_1_ms: stats(select1), tables }, null, 2)}\n`);
}

main()
  .catch((err) => {
    process.stderr.write(`${err && err.message ? err.message : 'measure failed'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });