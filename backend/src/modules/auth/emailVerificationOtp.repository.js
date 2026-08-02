const { prisma } = require('../../config/db');

async function invalidateActiveOtpsForUser(userId, email, tx = prisma) {
  const now = new Date();
  await tx.email_verification_otps.updateMany({
    where: {
      user_id: userId,
      email,
      used_at: null,
      expires_at: { gt: now },
    },
    data: {
      used_at: now,
      updated_at: now,
    },
  });
}

async function createOtpRecord(
  { userId, email, codeHash, expiresAt, lastSentAt },
  tx = prisma
) {
  return tx.email_verification_otps.create({
    data: {
      user_id: userId,
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      last_sent_at: lastSentAt,
      attempts_count: 0,
    },
  });
}

async function findLatestActiveOtp(userId, email) {
  const now = new Date();
  return prisma.email_verification_otps.findFirst({
    where: {
      user_id: userId,
      email,
      used_at: null,
      expires_at: { gt: now },
    },
    orderBy: { created_at: 'desc' },
  });
}

async function findLatestOtpForCooldown(userId, email) {
  return prisma.email_verification_otps.findFirst({
    where: { user_id: userId, email },
    orderBy: { last_sent_at: 'desc' },
  });
}

async function incrementOtpAttempts(id, tx = prisma) {
  return tx.email_verification_otps.update({
    where: { id },
    data: {
      attempts_count: { increment: 1 },
      updated_at: new Date(),
    },
  });
}

async function markOtpUsed(id, tx = prisma) {
  const now = new Date();
  return tx.email_verification_otps.update({
    where: { id },
    data: {
      used_at: now,
      updated_at: now,
    },
  });
}

async function markUserEmailVerified(userId, tx = prisma, method = 'OTP') {
  const now = new Date();
  return tx.users.update({
    where: { id: userId },
    data: {
      email_verified_at: now,
      email_verification_method: method,
      updated_at: now,
    },
    select: {
      id: true,
      email: true,
      status: true,
      email_verified_at: true,
      email_verification_method: true,
    },
  });
}

module.exports = {
  invalidateActiveOtpsForUser,
  createOtpRecord,
  findLatestActiveOtp,
  findLatestOtpForCooldown,
  incrementOtpAttempts,
  markOtpUsed,
  markUserEmailVerified,
};
