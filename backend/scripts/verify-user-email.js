const { prisma } = require('../src/config/db');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/verify-user-email.js <email>');
  process.exit(1);
}

async function main() {
  const normalized = email.trim().toLowerCase();
  await prisma.$executeRaw`
    UPDATE users
    SET email_verified_at = NOW(), updated_at = NOW()
    WHERE email = ${normalized}
  `;
  const rows = await prisma.$queryRaw`
    SELECT email, email_verified_at, status
    FROM users
    WHERE email = ${normalized}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) {
    throw new Error(`User not found: ${normalized}`);
  }
  console.log('Verified:', user);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
