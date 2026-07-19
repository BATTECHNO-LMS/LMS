/**
 * DB-MIGRATION-003 — Initialize a truly empty PostgreSQL database (cutoff-aware).
 *
 * Resolves ONLY migrations listed in the versioned baseline manifest.
 * Migrations after the cutoff remain pending for `prisma migrate deploy`.
 *
 * Never resets or drops an existing database. Never touches Neon.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  loadManifest,
  validateBaselineManifest,
  migrationsToResolveFromManifest,
  redactSecretsFromMessage,
} = require('./lib/baselineManifest');

const backendRoot = path.join(__dirname, '..');
const baselinesDir = path.join(backendRoot, 'prisma', 'baselines');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');

const BLOCKED_HOST_FRAGMENTS = [
  'neon.tech',
  'neon.database',
  'aws.neon',
  'azure.neon',
];

function log(msg) {
  console.log(`[db:init-empty] ${msg}`);
}

function fail(msg, code = 2) {
  console.error(`[db:init-empty] REFUSED: ${redactSecretsFromMessage(msg)}`);
  process.exit(code);
}

function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol,
      hostname: (u.hostname || '').toLowerCase(),
      port: u.port || '',
      database: (u.pathname || '').replace(/^\//, '').split('?')[0] || '',
    };
  } catch {
    return null;
  }
}

function classifyHost(hostname) {
  if (!hostname) return 'unknown';
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return 'local';
  if (BLOCKED_HOST_FRAGMENTS.some((f) => hostname.includes(f))) return 'neon-blocked';
  return 'remote';
}

function activeManifestPath() {
  const version = (process.env.EMPTY_DB_BASELINE_VERSION || 'v1').trim();
  return path.join(baselinesDir, `empty_init_${version}.manifest.json`);
}

function runPrisma(args, { allowFail = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    encoding: 'utf8',
    cwd: backendRoot,
    env: process.env,
    windowsHide: true,
  });
  if (result.status !== 0 && !allowFail) {
    console.error(redactSecretsFromMessage(result.stderr || result.stdout || String(result.error)));
    fail(`prisma ${args.join(' ')} failed with exit ${result.status}`, 1);
  }
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function assertTrulyEmpty(prisma) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "_prisma_migrations"`);
    if (rows[0].c > 0) {
      fail(`"_prisma_migrations" already has ${rows[0].c} row(s). Init is for empty databases only.`);
    }
    fail('"_prisma_migrations" exists (even empty). Refusing init — use a brand-new database.');
  } catch (e) {
    const msg = String(e.message || e);
    if (!/does not exist|42P01/i.test(msg)) throw e;
  }

  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  if (tables.length > 0) {
    fail(
      `Database already has ${tables.length} public table(s) (e.g. ${tables
        .slice(0, 5)
        .map((t) => t.tablename)
        .join(', ')}). Refusing init — will not alter populated databases.`
    );
  }
}

async function main() {
  if (process.env.ALLOW_EMPTY_DB_INIT !== 'true') {
    fail('Set ALLOW_EMPTY_DB_INIT=true to acknowledge empty-database bootstrap.');
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL is not set.');

  const parsed = parseDatabaseUrl(url);
  if (!parsed) fail('DATABASE_URL is not a valid URL.');

  const classification = classifyHost(parsed.hostname);
  log(`Target host classification: ${classification}`);
  log(`Target database name: ${parsed.database || '(default)'}`);
  log(`Target host: ${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`);

  if (classification === 'neon-blocked') {
    fail('Refusing Neon / shared cloud hosts. Create a disposable empty PostgreSQL database instead.');
  }
  if (classification === 'remote' && process.env.ALLOW_EMPTY_DB_INIT_REMOTE !== 'true') {
    fail('Remote hosts require ALLOW_EMPTY_DB_INIT_REMOTE=true (never use for production Neon).');
  }
  if (classification === 'unknown') {
    fail('Could not classify database host.');
  }

  // Fail-closed manifest validation BEFORE any SQL or history writes.
  let manifest;
  let validation;
  try {
    manifest = loadManifest(activeManifestPath());
    validation = validateBaselineManifest({
      manifest,
      baselinesDir,
      migrationsDir,
      schemaPath,
      schemaMismatchPolicy: process.env.BASELINE_REQUIRE_SCHEMA_MATCH === 'true' ? 'error' : 'warn',
    });
  } catch (e) {
    fail(e.message || String(e), 2);
  }

  for (const w of validation.warnings) log(`WARN: ${w}`);

  const toResolve = migrationsToResolveFromManifest(manifest);
  if (toResolve.length !== validation.migrationsToResolve.length) {
    fail('Internal error: resolve list mismatch');
  }

  log(
    `Baseline ${manifest.version}: resolving ${toResolve.length} migration(s) through cutoff ${manifest.lastMigration}`
  );
  if (validation.pendingAfterCutoff.length) {
    log(
      `${validation.pendingAfterCutoff.length} migration(s) after cutoff will remain pending for migrate deploy`
    );
  }

  const prisma = new PrismaClient();
  try {
    await assertTrulyEmpty(prisma);
  } finally {
    await prisma.$disconnect();
  }

  const sqlPath = path.join(baselinesDir, manifest.sqlFile);
  log(`Applying baseline SQL (${manifest.sqlFile})…`);
  runPrisma(['db', 'execute', '--file', sqlPath, '--schema', 'prisma/schema.prisma']);
  log('Baseline SQL applied.');

  log(`Recording ${toResolve.length} manifest migrations as applied…`);
  for (const name of toResolve) {
    if (!manifest.orderedMigrations.includes(name)) {
      fail(`Refusing to resolve migration not in manifest: ${name}`);
    }
    runPrisma(['migrate', 'resolve', '--applied', name]);
    log(`  applied: ${name}`);
  }

  log('Running prisma migrate deploy for any post-cutoff pending migrations…');
  const deploy = runPrisma(['migrate', 'deploy']);
  process.stdout.write(deploy.stdout);

  const status = runPrisma(['migrate', 'status']);
  process.stdout.write(status.stdout);

  const countClient = new PrismaClient();
  try {
    const rows = await countClient.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `);
    const appliedCount = rows[0].c;
    const expectedMin = toResolve.length;
    if (appliedCount < expectedMin) {
      fail(`Expected at least ${expectedMin} applied migrations, found ${appliedCount}`, 1);
    }
    log(`Applied migration rows: ${appliedCount} (manifest resolved: ${toResolve.length})`);
  } finally {
    await countClient.$disconnect();
  }

  if (validation.pendingAfterCutoff.length === 0) {
    if (!/Database schema is up to date/i.test(status.stdout)) {
      fail('Expected migrate status to report up to date when no post-cutoff migrations exist.', 1);
    }
  }

  log('Empty database initialization complete.');
}

main().catch((e) => {
  console.error(redactSecretsFromMessage(e.message || e));
  process.exit(1);
});
