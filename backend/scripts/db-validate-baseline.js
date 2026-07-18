/**
 * Validate the active empty-DB baseline manifest (no database writes).
 * Exit 0 on success; exit 2 on integrity failure.
 */
'use strict';

const path = require('path');
const {
  loadManifest,
  validateBaselineManifest,
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

try {
  const manifest = loadManifest(activeManifestPath());
  const schemaPolicy =
    process.env.BASELINE_REQUIRE_SCHEMA_MATCH === 'true' ? 'error' : 'warn';
  const result = validateBaselineManifest({
    manifest,
    baselinesDir,
    migrationsDir,
    schemaPath,
    schemaMismatchPolicy: schemaPolicy,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        version: result.version,
        cutoff: result.cutoff,
        represented_count: result.migrationsToResolve.length,
        pending_after_cutoff: result.pendingAfterCutoff,
        warnings: result.warnings,
      },
      null,
      2
    )
  );
  for (const w of result.warnings) {
    console.error(`[db:validate-baseline] WARN: ${w}`);
  }
} catch (e) {
  console.error(`[db:validate-baseline] FAIL: ${redactSecretsFromMessage(e.message || e)}`);
  process.exit(2);
}
