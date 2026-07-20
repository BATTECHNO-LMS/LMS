/**
 * Disable stale mobile push registrations for BATTECHNO LMS.
 *
 * A registration is "stale" when its `last_seen_at` is older than the
 * retention window (default 90 days) or it is already disabled.
 *
 * Dry-run by default — prints counts only. Never prints registration tokens.
 *
 * Usage:
 *   node scripts/cleanup-stale-push-registrations.js                    # dry-run preview
 *   node scripts/cleanup-stale-push-registrations.js --apply            # disable stale rows
 *   node scripts/cleanup-stale-push-registrations.js --apply --days=60  # custom retention window
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');

const APPLY_FLAG = '--apply';
const FORCE_PROD_FLAG = 'ALLOW_PUSH_CLEANUP_PRODUCTION';
const DEFAULT_DAYS = 90;

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[cleanup-stale-push-registrations] ${msg}`);
}

function parseDaysArg() {
  const arg = process.argv.find((a) => a.startsWith('--days='));
  if (!arg) return DEFAULT_DAYS;
  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : DEFAULT_DAYS;
}

function assertSafeToRun() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
  if (process.env.NODE_ENV === 'production' && process.env[FORCE_PROD_FLAG] !== 'true') {
    throw new Error(
      `Refusing to run in production without ${FORCE_PROD_FLAG}=true.`
    );
  }
}

async function main() {
  assertSafeToRun();
  const days = parseDaysArg();
  const apply = process.argv.includes(APPLY_FLAG);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stale = await prisma.mobile_push_registrations.findMany({
    where: {
      OR: [{ last_seen_at: { lt: cutoff } }, { disabled_at: { not: null } }],
    },
    select: { id: true, platform: true, disabled_at: true, last_seen_at: true },
  });

  const alreadyDisabled = stale.filter((r) => r.disabled_at != null).length;
  const toDisable = stale.filter((r) => r.disabled_at == null);

  log(`Retention window: ${days} days (cutoff ${cutoff.toISOString()})`);
  log(`Stale/disabled registrations found: ${stale.length}`);
  log(`  already disabled: ${alreadyDisabled}`);
  log(`  to disable now: ${toDisable.length}`);

  if (!apply) {
    log('DRY RUN — pass --apply to disable stale registrations. No changes made.');
    return;
  }

  if (!toDisable.length) {
    log('Nothing to disable.');
    return;
  }

  const result = await prisma.mobile_push_registrations.updateMany({
    where: { id: { in: toDisable.map((r) => r.id) } },
    data: { disabled_at: new Date() },
  });
  log(`Disabled ${result.count} stale registration(s).`);
}

main()
  .catch((err) => {
    log(`FAILED: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
