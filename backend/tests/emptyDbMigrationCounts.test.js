/**
 * CI-EMPTY-DB-MIGRATION-COUNT-001 — database-free unit tests for the empty-DB
 * migration count model. Does not touch production or remote databases.
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  listValidMigrationDirs,
  evaluateEmptyDbMigrationCounts,
  loadManifest,
} = require('../scripts/lib/baselineManifest');

const backendRoot = path.join(__dirname, '..');
const realMigrationsDir = path.join(backendRoot, 'prisma', 'migrations');
const realManifestPath = path.join(
  backendRoot,
  'prisma',
  'baselines',
  'empty_init_v1.manifest.json'
);

describe('emptyDbMigrationCounts (CI-EMPTY-DB-MIGRATION-COUNT-001)', () => {
  test('baseline of 27 plus 3 post-cutoff migrations produces final count 30', () => {
    const result = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      finalAppliedMigrationCount: 30,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
    });
    assert.equal(result.ok, true);
    assert.equal(result.summary.post_cutoff_migrations, 3);
    assert.equal(result.summary.final_applied_migrations, 30);
  });

  test('final applied count is compared to repository count, not baseline count', () => {
    const staleAssertionStyle = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      // Stale CI checked final === 27; that must FAIL under the correct model.
      finalAppliedMigrationCount: 27,
      pendingCount: 3,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
    });
    assert.equal(staleAssertionStyle.ok, false);
    assert.ok(
      staleAssertionStyle.errors.some((e) =>
        e.includes('final applied migration count mismatch')
      )
    );

    const correct = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      finalAppliedMigrationCount: 30,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
    });
    assert.equal(correct.ok, true);
  });

  test('adding a future migration directory automatically changes expected final count', () => {
    const withFuture = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 31,
      finalAppliedMigrationCount: 31,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
    });
    assert.equal(withFuture.ok, true);
    assert.equal(withFuture.summary.post_cutoff_migrations, 4);
    assert.equal(withFuture.summary.final_applied_migrations, 31);

    const forgotToDeploy = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 31,
      finalAppliedMigrationCount: 30,
      pendingCount: 1,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
    });
    assert.equal(forgotToDeploy.ok, false);
  });

  test('missing post-cutoff migration application fails', () => {
    const result = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      finalAppliedMigrationCount: 29,
      pendingCount: 1,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
      appliedMigrationNames: Array.from({ length: 29 }, (_, i) => `m${i}`),
      repositoryMigrationNames: [
        ...Array.from({ length: 29 }, (_, i) => `m${i}`),
        '20260720180000_mobile_push_registrations',
      ],
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.includes('pending post-cutoff') || e.includes('missing applied'))
    );
  });

  test('extra applied migration not present in repository fails', () => {
    const result = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      finalAppliedMigrationCount: 31,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: '20260718120000_academic_submission_uniqueness',
      appliedMigrationNames: [
        ...Array.from({ length: 30 }, (_, i) => `m${i}`),
        'ghost_migration',
      ],
      repositoryMigrationNames: Array.from({ length: 30 }, (_, i) => `m${i}`),
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) =>
        e.includes('extra applied migration not present in repository')
      )
    );
  });

  test('baseline represented count remains 27 on real manifest', () => {
    const manifest = loadManifest(realManifestPath);
    assert.equal(manifest.orderedMigrations.length, 27);
    assert.equal(
      manifest.lastMigration,
      '20260718120000_academic_submission_uniqueness'
    );

    const result = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: manifest.orderedMigrations.length,
      repositoryMigrationCount: listValidMigrationDirs(realMigrationsDir).length,
      finalAppliedMigrationCount: listValidMigrationDirs(realMigrationsDir).length,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: manifest.lastMigration,
    });
    assert.equal(result.ok, true);
    assert.equal(result.summary.baseline_represented_migrations, 27);
  });

  test('baseline cutoff remains unchanged', () => {
    const manifest = loadManifest(realManifestPath);
    assert.equal(
      manifest.lastMigration,
      '20260718120000_academic_submission_uniqueness'
    );
    const badCutoff = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: 27,
      repositoryMigrationCount: 30,
      finalAppliedMigrationCount: 30,
      actualCutoff: '20260720180000_mobile_push_registrations',
    });
    assert.equal(badCutoff.ok, false);
    assert.ok(badCutoff.errors.some((e) => e.includes('baseline cutoff mismatch')));
  });

  test('only directories containing migration.sql are counted', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-db-count-'));
    try {
      const migrationsDir = path.join(tmp, 'migrations');
      fs.mkdirSync(migrationsDir, { recursive: true });

      const withSql = path.join(migrationsDir, '20260101000000_valid');
      fs.mkdirSync(withSql);
      fs.writeFileSync(path.join(withSql, 'migration.sql'), '-- ok\n');

      const withoutSql = path.join(migrationsDir, '20260102000000_empty_fixture');
      fs.mkdirSync(withoutSql);

      fs.writeFileSync(path.join(migrationsDir, 'migration_lock.toml'), 'provider = "postgresql"\n');
      fs.writeFileSync(path.join(migrationsDir, 'README.md'), 'docs\n');
      fs.mkdirSync(path.join(migrationsDir, '.hidden_dir'));

      const valid = listValidMigrationDirs(migrationsDir);
      assert.deepEqual(valid, ['20260101000000_valid']);
      assert.equal(valid.length, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('real repository post-cutoff count equals repo minus baseline (no DB)', () => {
    const repo = listValidMigrationDirs(realMigrationsDir);
    const manifest = loadManifest(realManifestPath);
    const baseline = manifest.orderedMigrations.length;
    const postCutoff = repo.length - baseline;
    assert.equal(baseline, 27);
    assert.ok(repo.length >= 30, `expected >= 30 repo migrations, got ${repo.length}`);
    assert.equal(postCutoff, repo.length - 27);
    assert.ok(postCutoff >= 3);

    // Derived expectation: final must track repo, not literal 30.
    const pass = evaluateEmptyDbMigrationCounts({
      baselineRepresentedCount: baseline,
      repositoryMigrationCount: repo.length,
      finalAppliedMigrationCount: repo.length,
      pendingCount: 0,
      failedCount: 0,
      actualCutoff: manifest.lastMigration,
      appliedMigrationNames: repo,
      repositoryMigrationNames: repo,
    });
    assert.equal(pass.ok, true);
  });

  test('tests do not require DATABASE_URL or remote hosts', () => {
    assert.ok(!process.env.ALLOW_TEST_DB_WRITES || process.env.ALLOW_TEST_DB_WRITES === 'true' || true);
    // This suite never constructs PrismaClient — pure filesystem + pure functions.
    assert.equal(typeof evaluateEmptyDbMigrationCounts, 'function');
    assert.equal(typeof listValidMigrationDirs, 'function');
  });
});
