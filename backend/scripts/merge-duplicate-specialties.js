/**
 * Merge duplicate specialties and normalize canonical records.
 * Safe to rerun — reassigns users/field training references before deactivating duplicates.
 *
 * Usage: npm run merge:specialties
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { mergeDuplicateSpecialties } = require('./lib/specialtyMerge');
const { ensureSpecialties } = require('./lib/realBaseline');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[merge-specialties] ${msg}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const merged = await mergeDuplicateSpecialties({ log });
  if (!merged.length) {
    log('No duplicate specialties required merging.');
  }

  const specialties = await ensureSpecialties();
  log(`Active specialties in catalog: ${specialties.size}`);

  const active = await prisma.specialties.findMany({
    where: { status: 'active' },
    select: { name_ar: true, name_en: true, code: true },
    orderBy: { name_ar: 'asc' },
  });

  log('Active specialties:');
  for (const row of active) {
    log(`  • ${row.name_ar} / ${row.name_en} (${row.code})`);
  }

  const dupCheck = await prisma.$queryRaw`
    SELECT name_ar, COUNT(*)::int AS cnt
    FROM specialties
    WHERE status = 'active'
    GROUP BY name_ar
    HAVING COUNT(*) > 1
  `;
  if (dupCheck.length) {
    throw new Error(`Duplicate active Arabic names remain: ${JSON.stringify(dupCheck)}`);
  }

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
