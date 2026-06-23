/**
 * Link users without primary_university_id to universities via email domain.
 * Run: node scripts/backfill-university-from-email.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { ensureUserLinkedToUniversityFromEmail } = require('../src/modules/auth/universityEmailLink.service');

async function main() {
  const users = await prisma.users.findMany({
    where: { primary_university_id: null },
    select: { id: true, email: true, full_name: true },
  });

  let linked = 0;
  for (const u of users) {
    const uni = await ensureUserLinkedToUniversityFromEmail(u.id, u.email);
    if (uni) {
      linked += 1;
      // eslint-disable-next-line no-console
      console.log(`Linked ${u.email} → ${uni.name}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Linked ${linked} of ${users.length} users without university.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
