/**
 * Ensures `student` (+ optional `super_admin`) roles and a demo university with one email domain exist.
 * Run: node scripts/seed-auth-minimum.js
 */
const { prisma } = require('../src/config/db');

async function ensureRole(code, name, scope) {
  const existing = await prisma.roles.findFirst({ where: { code } });
  if (existing) return existing;
  return prisma.roles.create({
    data: { code, name, scope },
  });
}

async function main() {
  await ensureRole('student', 'Student', 'university');
  await ensureRole('super_admin', 'Super Admin', 'global');

  const uniName = 'Demo LMS University';
  let uni = await prisma.universities.findFirst({ where: { name: uniName } });
  if (!uni) {
    uni = await prisma.universities.create({
      data: { name: uniName, status: 'active' },
    });
  }

  const demoDomain = 'student.demo-lms.test';
  const domainRow = await prisma.university_email_domains.findFirst({
    where: { university_id: uni.id, domain: demoDomain },
  });
  if (!domainRow) {
    await prisma.university_email_domains.create({
      data: {
        university_id: uni.id,
        domain: demoDomain,
        is_active: true,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Auth seed complete.');
  // eslint-disable-next-line no-console
  console.log('Sample registration:', {
    university_id: uni.id,
    email: `you@${demoDomain}`,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
