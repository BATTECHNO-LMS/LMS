/**
 * Regenerate a versioned empty-DB baseline + manifest (DB-MIGRATION-003).
 *
 * Requires:
 *   ALLOW_BASELINE_REGENERATION=true
 *   BASELINE_VERSION=v2   (new version id; must not overwrite unless FORCE_BASELINE_OVERWRITE=true)
 *   BASELINE_CUTOFF=<migration_name>
 *
 * Does NOT connect to Neon. Does NOT modify Neon history.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildManifestPayload, GENERATOR_VERSION } = require('./lib/baselineManifest');

const backendRoot = path.join(__dirname, '..');
const outDir = path.join(backendRoot, 'prisma', 'baselines');
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');

function fail(msg, code = 2) {
  console.error(`[db:generate-baseline] REFUSED: ${msg}`);
  process.exit(code);
}

if (process.env.ALLOW_BASELINE_REGENERATION !== 'true') {
  fail(
    'Set ALLOW_BASELINE_REGENERATION=true and provide BASELINE_VERSION + BASELINE_CUTOFF. Refusing silent overwrite.'
  );
}

const version = String(process.env.BASELINE_VERSION || '').trim();
const cutoff = String(process.env.BASELINE_CUTOFF || '').trim();
if (!version || !/^v\d+$/.test(version)) {
  fail('BASELINE_VERSION is required (e.g. v2).');
}
if (!cutoff || !/^\d{14}_/.test(cutoff)) {
  fail('BASELINE_CUTOFF is required (exact migration folder name).');
}

fs.mkdirSync(outDir, { recursive: true });
const sqlFile = `empty_init_${version}.sql`;
const manifestFile = `empty_init_${version}.manifest.json`;
const outFile = path.join(outDir, sqlFile);
const manifestOut = path.join(outDir, manifestFile);

if (
  (fs.existsSync(outFile) || fs.existsSync(manifestOut)) &&
  process.env.FORCE_BASELINE_OVERWRITE !== 'true'
) {
  fail(
    `Baseline ${version} already exists. Set FORCE_BASELINE_OVERWRITE=true only after human review.`
  );
}

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  {
    encoding: 'utf8',
    cwd: backendRoot,
    env: process.env,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || result.error);
  process.exit(result.status || 1);
}

const header = [
  `-- BATTECHNO LMS — empty database bootstrap ${version} (DB-MIGRATION-003)`,
  '-- Generated from prisma/schema.prisma via `prisma migrate diff --from-empty`.',
  '-- Structure only. No data. Do NOT run against shared/production Neon.',
  `-- Cutoff migration: ${cutoff}`,
  `-- Apply only through: EMPTY_DB_BASELINE_VERSION=${version} npm run db:init-empty`,
  `-- Generated-at: ${new Date().toISOString()}`,
  `-- Generator: ${GENERATOR_VERSION}`,
  '',
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
  '',
].join('\n');

const body = (result.stdout || '').trim();
if (!body) {
  fail('Generated baseline SQL was empty.', 1);
}

fs.writeFileSync(outFile, `${header}${body}\n`);

const manifest = buildManifestPayload({
  version,
  sqlFile,
  sqlPath: outFile,
  schemaPath,
  migrationsDir,
  cutoffMigration: cutoff,
});
fs.writeFileSync(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${outFile}`);
console.log(`Wrote ${manifestOut}`);
console.log(
  JSON.stringify(
    {
      version: manifest.version,
      cutoff: manifest.lastMigration,
      represented: manifest.orderedMigrations.length,
      sqlSha256: manifest.sqlSha256,
    },
    null,
    2
  )
);
console.log(
  'Review SQL + manifest, then set EMPTY_DB_BASELINE_VERSION to activate. Do not modify Neon.'
);
