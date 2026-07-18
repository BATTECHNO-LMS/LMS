/**
 * DB-MIGRATION-003 — Versioned empty-database baseline manifest helpers.
 * Pure filesystem/crypto utilities. No database connections. No secrets in errors.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GENERATOR_VERSION = 'db-migration-003-v1';
const MANIFEST_REQUIRED_FIELDS = [
  'version',
  'sqlFile',
  'sqlSha256',
  'schemaSha256',
  'firstMigration',
  'lastMigration',
  'orderedMigrations',
  'migrationChecksums',
  'generatedAt',
  'generatorVersion',
];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256String(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function listMigrationDirs(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function migrationSqlPath(migrationsDir, name) {
  return path.join(migrationsDir, name, 'migration.sql');
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    const err = new Error(`Baseline manifest missing: ${path.basename(manifestPath)}`);
    err.code = 'BASELINE_MANIFEST_MISSING';
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    const err = new Error('Baseline manifest is not valid JSON');
    err.code = 'BASELINE_MANIFEST_INVALID';
    throw err;
  }
  return raw;
}

function assertManifestShape(manifest) {
  for (const field of MANIFEST_REQUIRED_FIELDS) {
    if (manifest[field] == null || manifest[field] === '') {
      const err = new Error(`Baseline manifest missing required field: ${field}`);
      err.code = 'BASELINE_MANIFEST_INVALID';
      throw err;
    }
  }
  if (!Array.isArray(manifest.orderedMigrations) || manifest.orderedMigrations.length === 0) {
    const err = new Error('Baseline manifest orderedMigrations must be a non-empty array');
    err.code = 'BASELINE_MANIFEST_INVALID';
    throw err;
  }
  if (
    typeof manifest.migrationChecksums !== 'object' ||
    manifest.migrationChecksums == null ||
    Array.isArray(manifest.migrationChecksums)
  ) {
    const err = new Error('Baseline manifest migrationChecksums must be an object');
    err.code = 'BASELINE_MANIFEST_INVALID';
    throw err;
  }
}

/**
 * Validate manifest against baseline SQL + migration files on disk.
 * @param {object} options
 * @param {object} options.manifest
 * @param {string} options.baselinesDir
 * @param {string} options.migrationsDir
 * @param {string} [options.schemaPath]
 * @param {'ignore'|'warn'|'error'} [options.schemaMismatchPolicy='warn']
 * @returns {{ ok: true, warnings: string[], migrationsToResolve: string[], pendingAfterCutoff: string[] }}
 */
function validateBaselineManifest(options) {
  const {
    manifest,
    baselinesDir,
    migrationsDir,
    schemaPath,
    schemaMismatchPolicy = 'warn',
  } = options;

  assertManifestShape(manifest);
  const warnings = [];

  const sqlPath = path.join(baselinesDir, manifest.sqlFile);
  if (!fs.existsSync(sqlPath)) {
    const err = new Error(`Baseline SQL file missing: ${manifest.sqlFile}`);
    err.code = 'BASELINE_SQL_MISSING';
    throw err;
  }

  const sqlSha = sha256File(sqlPath);
  if (sqlSha !== manifest.sqlSha256) {
    const err = new Error('Baseline SQL checksum mismatch (empty_init SQL was modified)');
    err.code = 'BASELINE_SQL_CHECKSUM_MISMATCH';
    throw err;
  }

  const ordered = manifest.orderedMigrations.map(String);
  const seen = new Set();
  for (const name of ordered) {
    if (seen.has(name)) {
      const err = new Error(`Duplicate migration in baseline manifest: ${name}`);
      err.code = 'BASELINE_DUPLICATE_MIGRATION';
      throw err;
    }
    seen.add(name);
  }

  if (ordered[0] !== manifest.firstMigration) {
    const err = new Error('Baseline firstMigration does not match orderedMigrations[0]');
    err.code = 'BASELINE_ORDER_MISMATCH';
    throw err;
  }
  if (ordered[ordered.length - 1] !== manifest.lastMigration) {
    const err = new Error('Baseline lastMigration (cutoff) does not match orderedMigrations end');
    err.code = 'BASELINE_ORDER_MISMATCH';
    throw err;
  }

  const diskMigrations = listMigrationDirs(migrationsDir);
  const diskSet = new Set(diskMigrations);

  for (const name of ordered) {
    if (!diskSet.has(name)) {
      const err = new Error(`Represented migration directory missing: ${name}`);
      err.code = 'BASELINE_MIGRATION_MISSING';
      throw err;
    }
    const sqlFile = migrationSqlPath(migrationsDir, name);
    if (!fs.existsSync(sqlFile)) {
      const err = new Error(`Represented migration.sql missing: ${name}`);
      err.code = 'BASELINE_MIGRATION_MISSING';
      throw err;
    }
    const expected = manifest.migrationChecksums[name];
    if (!expected) {
      const err = new Error(`Manifest missing checksum for migration: ${name}`);
      err.code = 'BASELINE_MANIFEST_INVALID';
      throw err;
    }
    const actual = sha256File(sqlFile);
    if (actual !== expected) {
      const err = new Error(
        `Represented migration checksum mismatch: ${name} (historical migration changed; requires human review)`
      );
      err.code = 'BASELINE_MIGRATION_CHECKSUM_MISMATCH';
      throw err;
    }
  }

  // Order among represented migrations must match chronological disk order subset.
  const diskIndex = new Map(diskMigrations.map((n, i) => [n, i]));
  for (let i = 1; i < ordered.length; i += 1) {
    if (diskIndex.get(ordered[i]) <= diskIndex.get(ordered[i - 1])) {
      const err = new Error('Baseline orderedMigrations is not chronological vs repository');
      err.code = 'BASELINE_ORDER_MISMATCH';
      throw err;
    }
  }

  // Unknown migration directories that sort before cutoff but are not in the manifest.
  const cutoffIdx = diskIndex.get(manifest.lastMigration);
  if (cutoffIdx == null) {
    const err = new Error(`Cutoff migration missing on disk: ${manifest.lastMigration}`);
    err.code = 'BASELINE_CUTOFF_MISSING';
    throw err;
  }
  for (const name of diskMigrations) {
    if (diskIndex.get(name) <= cutoffIdx && !seen.has(name)) {
      const err = new Error(
        `Unknown migration before baseline cutoff is not in manifest: ${name}`
      );
      err.code = 'BASELINE_UNKNOWN_BEFORE_CUTOFF';
      throw err;
    }
  }

  const pendingAfterCutoff = diskMigrations.filter((name) => diskIndex.get(name) > cutoffIdx);

  if (schemaPath && fs.existsSync(schemaPath)) {
    const schemaSha = sha256File(schemaPath);
    if (schemaSha !== manifest.schemaSha256) {
      const msg =
        'Prisma schema checksum differs from baseline generation time (expected when schema advances with later migrations)';
      if (schemaMismatchPolicy === 'error') {
        const err = new Error(msg);
        err.code = 'BASELINE_SCHEMA_CHECKSUM_MISMATCH';
        throw err;
      }
      if (schemaMismatchPolicy === 'warn') warnings.push(msg);
    }
  }

  return {
    ok: true,
    warnings,
    migrationsToResolve: ordered.slice(),
    pendingAfterCutoff,
    version: manifest.version,
    cutoff: manifest.lastMigration,
  };
}

/**
 * Build a new manifest object (does not write files).
 */
function buildManifestPayload({
  version,
  sqlFile,
  sqlPath,
  schemaPath,
  migrationsDir,
  cutoffMigration,
  generatedAt = new Date().toISOString(),
  generatorVersion = GENERATOR_VERSION,
}) {
  const all = listMigrationDirs(migrationsDir);
  const cutoffIdx = all.indexOf(cutoffMigration);
  if (cutoffIdx < 0) {
    throw new Error(`Cutoff migration not found: ${cutoffMigration}`);
  }
  const orderedMigrations = all.slice(0, cutoffIdx + 1);
  const migrationChecksums = {};
  for (const name of orderedMigrations) {
    migrationChecksums[name] = sha256File(migrationSqlPath(migrationsDir, name));
  }
  return {
    version,
    sqlFile,
    sqlSha256: sha256File(sqlPath),
    schemaSha256: sha256File(schemaPath),
    firstMigration: orderedMigrations[0],
    lastMigration: cutoffMigration,
    orderedMigrations,
    migrationChecksums,
    generatedAt,
    generatorVersion,
  };
}

/**
 * Select which migrations to resolve — ONLY from manifest. Never scans disk for resolve list.
 */
function migrationsToResolveFromManifest(manifest) {
  assertManifestShape(manifest);
  return manifest.orderedMigrations.map(String);
}

function redactSecretsFromMessage(message) {
  return String(message || '')
    .replace(/postgresql:\/\/[^\s)'"]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s)'"]+/gi, 'postgres://***')
    .replace(/:[^:@/\s]+@/g, ':***@');
}

module.exports = {
  GENERATOR_VERSION,
  MANIFEST_REQUIRED_FIELDS,
  sha256File,
  sha256String,
  listMigrationDirs,
  migrationSqlPath,
  loadManifest,
  assertManifestShape,
  validateBaselineManifest,
  buildManifestPayload,
  migrationsToResolveFromManifest,
  redactSecretsFromMessage,
};
