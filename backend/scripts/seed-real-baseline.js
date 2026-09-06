/**
 * Real baseline seed for production/staging use.
 *
 * Creates/updates (idempotent — no deletes):
 * - System roles (RBAC)
 * - Jordanian universities + active email domains + UNIVERSITY org bridges
 * - Global active specialties + university specialty programs
 *
 * Does NOT create demo users. Create Super Admin manually after setup.
 *
 * Usage: npm run seed:real-baseline
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { seedRealBaseline } = require('./lib/realBaseline');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[seed-real-baseline] ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const result = await seedRealBaseline();

  for (const uni of result.universities) {
    log(`Upserted university: ${uni.name} / ${uni.domain}`);
  }

  log(`Specialties ensured: ${result.specialties}`);
  log(`University specialties ensured: ${result.universitySpecialties}`);
  if (result.deactivatedUniversitySpecialties) {
    log(`University specialties deactivated: ${result.deactivatedUniversitySpecialties}`);
  }
  log('Done.');
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
