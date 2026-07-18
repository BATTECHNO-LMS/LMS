/**
 * Database-free unit tests for versioned baseline manifest (DB-MIGRATION-003).
 */
'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  sha256File,
  buildManifestPayload,
  validateBaselineManifest,
  loadManifest,
  migrationsToResolveFromManifest,
  redactSecretsFromMessage,
} = require('../scripts/lib/baselineManifest');

function writeMigration(dir, name, sql) {
  const d = path.join(dir, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'migration.sql'), sql);
}

describe('baselineManifest (DB-MIGRATION-003)', () => {
  let tmp;
  let baselinesDir;
  let migrationsDir;
  let schemaPath;
  let sqlPath;
  let manifest;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-manifest-'));
    baselinesDir = path.join(tmp, 'baselines');
    migrationsDir = path.join(tmp, 'migrations');
    fs.mkdirSync(baselinesDir, { recursive: true });
    fs.mkdirSync(migrationsDir, { recursive: true });
    schemaPath = path.join(tmp, 'schema.prisma');
    fs.writeFileSync(schemaPath, 'generator client { provider = "prisma-client-js" }\n');
    writeMigration(migrationsDir, '20260101000000_one', '-- one\n');
    writeMigration(migrationsDir, '20260102000000_two', '-- two\n');
    writeMigration(migrationsDir, '20260103000000_three', '-- three\n');
    sqlPath = path.join(baselinesDir, 'empty_init_v1.sql');
    fs.writeFileSync(sqlPath, '-- baseline sql v1\nCREATE TABLE t(id int);\n');
    manifest = buildManifestPayload({
      version: 'v1',
      sqlFile: 'empty_init_v1.sql',
      sqlPath,
      schemaPath,
      migrationsDir,
      cutoffMigration: '20260102000000_two',
    });
    fs.writeFileSync(
      path.join(baselinesDir, 'empty_init_v1.manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
  });

  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('valid manifest passes', () => {
    const result = validateBaselineManifest({
      manifest,
      baselinesDir,
      migrationsDir,
      schemaPath,
      schemaMismatchPolicy: 'error',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.migrationsToResolve, [
      '20260101000000_one',
      '20260102000000_two',
    ]);
    assert.deepEqual(result.pendingAfterCutoff, ['20260103000000_three']);
  });

  test('missing manifest fails', () => {
    assert.throws(
      () => loadManifest(path.join(baselinesDir, 'missing.manifest.json')),
      /missing/i
    );
  });

  test('SQL checksum mismatch fails', () => {
    const bad = { ...manifest, sqlSha256: '0'.repeat(64) };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_SQL_CHECKSUM_MISMATCH'
    );
  });

  test('schema checksum mismatch reported by policy', () => {
    const bad = { ...manifest, schemaSha256: '0'.repeat(64) };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'error',
        }),
      (e) => e.code === 'BASELINE_SCHEMA_CHECKSUM_MISMATCH'
    );
    const warned = validateBaselineManifest({
      manifest: bad,
      baselinesDir,
      migrationsDir,
      schemaPath,
      schemaMismatchPolicy: 'warn',
    });
    assert.equal(warned.warnings.length >= 1, true);
  });

  test('missing represented migration fails', () => {
    const bad = {
      ...manifest,
      orderedMigrations: [...manifest.orderedMigrations, '20260101999999_ghost'],
      lastMigration: '20260101999999_ghost',
      migrationChecksums: {
        ...manifest.migrationChecksums,
        '20260101999999_ghost': 'abc',
      },
    };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_MIGRATION_MISSING'
    );
  });

  test('represented migration checksum mismatch fails', () => {
    const bad = {
      ...manifest,
      migrationChecksums: {
        ...manifest.migrationChecksums,
        '20260101000000_one': '0'.repeat(64),
      },
    };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_MIGRATION_CHECKSUM_MISMATCH'
    );
  });

  test('migration-order change fails', () => {
    const bad = {
      ...manifest,
      orderedMigrations: ['20260102000000_two', '20260101000000_one'],
      firstMigration: '20260102000000_two',
      lastMigration: '20260101000000_one',
    };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_ORDER_MISMATCH'
    );
  });

  test('duplicate migration entry fails', () => {
    const bad = {
      ...manifest,
      orderedMigrations: [
        '20260101000000_one',
        '20260101000000_one',
        '20260102000000_two',
      ],
    };
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: bad,
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_DUPLICATE_MIGRATION'
    );
  });

  test('unknown migration before the cutoff fails', () => {
    writeMigration(migrationsDir, '20260101500000_inserted', '-- inserted before cutoff\n');
    try {
      assert.throws(
        () =>
          validateBaselineManifest({
            manifest,
            baselinesDir,
            migrationsDir,
            schemaPath,
            schemaMismatchPolicy: 'ignore',
          }),
        (e) => e.code === 'BASELINE_UNKNOWN_BEFORE_CUTOFF'
      );
    } finally {
      fs.rmSync(path.join(migrationsDir, '20260101500000_inserted'), {
        recursive: true,
        force: true,
      });
    }
  });

  test('new migration after cutoff is not marked applied (resolve list)', () => {
    const list = migrationsToResolveFromManifest(manifest);
    assert.equal(list.includes('20260103000000_three'), false);
    assert.deepEqual(list, ['20260101000000_one', '20260102000000_two']);
  });

  test('only manifest migrations are passed to resolve', () => {
    const list = migrationsToResolveFromManifest(manifest);
    assert.equal(list.length, 2);
    assert.equal(list.includes('20260103000000_three'), false);
  });

  test('script does not discover and resolve all directories dynamically', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'db-init-empty.js'),
      'utf8'
    );
    assert.match(src, /migrationsToResolveFromManifest/);
    assert.equal(/listMigrations\s*\(/.test(src), false);
    assert.match(src, /orderedMigrations/);
  });

  test('invalid manifest fails before database writes (shape)', () => {
    assert.throws(
      () =>
        validateBaselineManifest({
          manifest: { version: 'v1' },
          baselinesDir,
          migrationsDir,
          schemaPath,
          schemaMismatchPolicy: 'ignore',
        }),
      (e) => e.code === 'BASELINE_MANIFEST_INVALID'
    );
  });

  test('credentials are absent from redacted errors', () => {
    const msg = redactSecretsFromMessage(
      'fail postgresql://super_secret_user:super_secret_pass@127.0.0.1:5432/db'
    );
    assert.equal(msg.includes('super_secret_user'), false);
    assert.equal(msg.includes('super_secret_pass'), false);
    assert.match(msg, /postgresql:\/\/\*\*\*/);
  });

  test('baseline regeneration requires explicit approval', () => {
    const script = path.join(__dirname, '..', 'scripts', 'generate-empty-baseline-sql.js');
    const denied = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, ALLOW_BASELINE_REGENERATION: undefined },
      windowsHide: true,
    });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr || denied.stdout, /ALLOW_BASELINE_REGENERATION/);
  });

  test('existing baseline cannot be overwritten accidentally', () => {
    const script = path.join(__dirname, '..', 'scripts', 'generate-empty-baseline-sql.js');
    const denied = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        ALLOW_BASELINE_REGENERATION: 'true',
        BASELINE_VERSION: 'v1',
        BASELINE_CUTOFF: '20260718120000_academic_submission_uniqueness',
        FORCE_BASELINE_OVERWRITE: 'false',
      },
      windowsHide: true,
    });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr || denied.stdout, /already exists|FORCE_BASELINE_OVERWRITE/i);
  });

  test('repo v1 manifest validates against real files', () => {
    const root = path.join(__dirname, '..');
    const realBaselines = path.join(root, 'prisma', 'baselines');
    const realMigrations = path.join(root, 'prisma', 'migrations');
    const realSchema = path.join(root, 'prisma', 'schema.prisma');
    const m = loadManifest(path.join(realBaselines, 'empty_init_v1.manifest.json'));
    const result = validateBaselineManifest({
      manifest: m,
      baselinesDir: realBaselines,
      migrationsDir: realMigrations,
      schemaPath: realSchema,
      schemaMismatchPolicy: 'warn',
    });
    assert.equal(result.migrationsToResolve.length, 27);
    assert.equal(result.cutoff, '20260718120000_academic_submission_uniqueness');
    assert.equal(result.pendingAfterCutoff.length, 0);
  });
});
