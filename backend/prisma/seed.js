/**
 * Default Prisma seed — real baseline only (roles, Mutah University, specialties).
 * Does NOT create demo users. For local demo datasets use npm run seed:demo (dev only).
 */
const { prisma } = require('../src/config/db');
const { seedRealBaseline } = require('../scripts/lib/realBaseline');

async function main() {
  const result = await seedRealBaseline();
  // eslint-disable-next-line no-console
  console.log('Seed completed (real baseline).');
  // eslint-disable-next-line no-console
  console.log('University:', result.university.name, result.university.id);
  // eslint-disable-next-line no-console
  console.log('Domain: mutah.edu.jo');
  // eslint-disable-next-line no-console
  console.log('Specialties:', result.specialties);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
