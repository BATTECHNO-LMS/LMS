/**
 * Real baseline seed for production/staging use.
 *
 * Creates/updates:
 * - System roles (RBAC)
 * - جامعة مؤتة / Mutah University
 * - Active email domain: mutah.edu.jo
 * - 10 global active specialties
 *
 * Does NOT create demo users. Create Super Admin manually after setup.
 *
 * Usage: node scripts/seed-real-baseline.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { seedRealBaseline } = require('./lib/realBaseline');
const { MUTAH_EMAIL_DOMAIN } = require('./lib/baselineCatalog');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[seed-real-baseline] ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const result = await seedRealBaseline();

  log('Real baseline seed completed.');
  log(`Roles ensured: ${result.roles}`);
  log(`University: ${result.university.name} (${result.university.id})`);
  log(`Email domain: ${MUTAH_EMAIL_DOMAIN}`);
  log(`Specialties: ${result.specialties}`);
  log('');
  log('Next steps:');
  log('  1. Create Super Admin via admin panel or a one-off secure script.');
  log('  2. Do NOT run seed:demo or seed:analytics-demo on production.');
}

main()
  .catch((err) => {
    log(`FAILED: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
