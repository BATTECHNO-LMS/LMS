/**
 * Mark all users as email-verified and consume pending verification OTPs.
 * Usage: node scripts/verify-all-user-emails.js
 */
const { prisma } = require('../src/config/db');

async function main() {
  const before = await prisma.users.count({ where: { email_verified_at: null } });
  const total = await prisma.users.count();

  const now = new Date();
  const result = await prisma.users.updateMany({
    where: { email_verified_at: null },
    data: { email_verified_at: now, updated_at: now },
  });

  const otpResult = await prisma.email_verification_otps.updateMany({
    where: { used_at: null },
    data: { used_at: now, updated_at: now },
  });

  const after = await prisma.users.count({ where: { email_verified_at: null } });

  console.log('Email verification bulk update complete:');
  console.log(`  Total users:           ${total}`);
  console.log(`  Unverified before:     ${before}`);
  console.log(`  Verified now:          ${result.count}`);
  console.log(`  OTPs marked used:      ${otpResult.count}`);
  console.log(`  Unverified remaining:  ${after}`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
