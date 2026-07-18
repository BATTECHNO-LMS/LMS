/**
 * Disposable-DB proof: baseline resolves only through cutoff; a synthetic later
 * migration stays pending then executes via migrate deploy.
 *
 * Does not leave the synthetic migration in the repository when finished.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { loadManifest, validateBaselineManifest } = require('./lib/baselineManifest');

const backendRoot = path.join(__dirname, '..');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
const fixtureName = '20990101120000_baseline_cutoff_fixture';
const fixtureDir = path.join(migrationsDir, fixtureName);
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');

function fail(msg, code = 1) {
  console.error(`[prove-baseline-cutoff] ${msg}`);
  process.exit(code);
}

function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: backendRoot,
    env,
    windowsHide: true,
    shell: false,
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    fail(`${args.join(' ')} failed with ${result.status}`);
  }
  return result.stdout || '';
}

function cleanupFixture() {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

async function main() {
  if (process.env.ALLOW_EMPTY_DB_INIT !== 'true') {
    fail('ALLOW_EMPTY_DB_INIT=true required');
  }
  if (!process.env.DATABASE_URL) fail('DATABASE_URL required');

  cleanupFixture();
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, 'migration.sql'),
    [
      '-- Synthetic post-cutoff migration for DB-MIGRATION-003 cutoff proof.',
      '-- Harmless; removed after the disposable database test.',
      'CREATE TABLE IF NOT EXISTS "baseline_cutoff_fixture" (',
      '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  "note" TEXT NOT NULL DEFAULT \'db-migration-003\'',
      ');',
      '',
    ].join('\n')
  );

  try {
    const baselinesDir = path.join(backendRoot, 'prisma', 'baselines');
    const manifest = loadManifest(path.join(baselinesDir, 'empty_init_v1.manifest.json'));
    const validation = validateBaselineManifest({
      manifest,
      baselinesDir,
      migrationsDir,
      schemaPath: path.join(backendRoot, 'prisma', 'schema.prisma'),
      schemaMismatchPolicy: 'warn',
    });
    if (!validation.pendingAfterCutoff.includes(fixtureName)) {
      fail(`Expected ${fixtureName} in pendingAfterCutoff`);
    }
    if (validation.migrationsToResolve.includes(fixtureName)) {
      fail('Fixture must not be in resolve list');
    }
    console.log(
      JSON.stringify(
        {
          resolve_count: validation.migrationsToResolve.length,
          pending_after_cutoff: validation.pendingAfterCutoff,
        },
        null,
        2
      )
    );

    run(process.execPath, [path.join(__dirname, 'db-init-empty.js')]);

    const prisma = new PrismaClient();
    try {
      const applied = await prisma.$queryRawUnsafe(`
        SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name
      `);
      const names = applied.map((r) => r.migration_name);
      if (names.length !== 28) {
        fail(`Expected 28 applied after init+deploy, found ${names.length}`);
      }
      if (!names.includes(fixtureName)) {
        fail('Fixture migration was not applied by migrate deploy');
      }
      for (const m of validation.migrationsToResolve) {
        if (!names.includes(m)) fail(`Missing resolved migration ${m}`);
      }
      const tables = await prisma.$queryRawUnsafe(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'baseline_cutoff_fixture'
      `);
      if (!tables.length) fail('baseline_cutoff_fixture table missing after deploy');
      console.log(
        JSON.stringify(
          {
            ok: true,
            applied_count: names.length,
            fixture_applied: true,
            fixture_table_present: true,
          },
          null,
          2
        )
      );
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    cleanupFixture();
  }
}

main().catch((e) => {
  cleanupFixture();
  console.error(e);
  process.exit(1);
});
