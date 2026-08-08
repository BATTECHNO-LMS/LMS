'use strict';

/**
 * Production/Docker entry: apply pending Prisma migrations, then start the API.
 * Never creates migrations — only `prisma migrate deploy`.
 *
 * Neon / PgBouncer: advisory locks used by migrate do not work on pooled
 * (`*-pooler.*`) URLs (Prisma P1002). Prefer DIRECT_URL, otherwise derive the
 * non-pooler host by stripping `-pooler` from DATABASE_URL for migrate only.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const MAX_ATTEMPTS = Math.max(1, Number(process.env.PRISMA_MIGRATE_DEPLOY_ATTEMPTS || 5));
const RETRY_MS = Math.max(500, Number(process.env.PRISMA_MIGRATE_DEPLOY_RETRY_MS || 3000));

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Connection used only for `prisma migrate deploy`.
 * Runtime app queries keep using process.env.DATABASE_URL (pooled OK).
 */
function resolveMigrateDatabaseUrl(env) {
  const direct = String(env.DIRECT_URL || '').trim();
  if (direct) return direct;

  const url = String(env.DATABASE_URL || '').trim();
  if (!url) return url;

  // Neon pooled host: ep-xxx-pooler.region.aws.neon.tech → ep-xxx.region.aws.neon.tech
  if (/-pooler\./i.test(url)) {
    return url.replace(/-pooler\./i, '.');
  }
  return url;
}

function hostOf(url) {
  const match = String(url).match(/@([^/?]+)/);
  return match ? match[1] : '(none)';
}

function runMigrateDeploy(attempt, migrateUrl) {
  // eslint-disable-next-line no-console
  console.log(
    `[start] prisma migrate deploy attempt ${attempt}/${MAX_ATTEMPTS} → ${hostOf(migrateUrl)}`
  );
  return spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      // Override only for this child; do not mutate process.env for the API.
      DATABASE_URL: migrateUrl,
      DIRECT_URL: String(process.env.DIRECT_URL || '').trim() || migrateUrl,
    },
  });
}

function deployMigrations() {
  if (String(process.env.SKIP_PRISMA_MIGRATE_ON_START || '').toLowerCase() === 'true') {
    // eslint-disable-next-line no-console
    console.log('[start] SKIP_PRISMA_MIGRATE_ON_START=true — skipping migrate deploy');
    return;
  }

  const migrateUrl = resolveMigrateDatabaseUrl(process.env);
  if (!migrateUrl) {
    // eslint-disable-next-line no-console
    console.error('[start] DATABASE_URL / DIRECT_URL missing; cannot migrate');
    process.exit(1);
  }

  let last = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    last = runMigrateDeploy(attempt, migrateUrl);
    if (last.status === 0) return;

    if (attempt < MAX_ATTEMPTS) {
      const wait = RETRY_MS * attempt;
      // eslint-disable-next-line no-console
      console.error(
        `[start] migrate deploy failed (exit ${last.status}); retrying in ${wait}ms (P1002 lock / transient neon)…`
      );
      sleepSync(wait);
    }
  }

  // eslint-disable-next-line no-console
  console.error('prisma migrate deploy failed; refusing to start API');
  process.exit(last?.status == null ? 1 : last.status);
}

deployMigrations();
require('../src/server');
