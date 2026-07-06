/**
 * DEV/STAGING ONLY — verified active test accounts for all system roles.
 *
 * University: جامعة باتيوني (batuni.edu)
 * Password: set in seed script (hashed in DB) — local dev only.
 *
 * Usage: npm run seed:test-accounts
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { seedTestAccounts } = require('./lib/testAccounts');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[seed-test-accounts] ${msg}`);
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed test accounts in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
}

async function main() {
  assertSafeEnvironment();
  await seedTestAccounts({ log: (msg) => log(msg) });
  log('Done.');
}

main()
  .catch((err) => {
    log(`FAILED: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
