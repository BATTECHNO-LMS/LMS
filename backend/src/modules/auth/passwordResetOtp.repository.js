const { prisma } = require('../../config/db');

async function invalidateActiveOtpsForEmail(email, tx = prisma) {
  const now = new Date();
  await tx.password_reset_otps.updateMany({
    where: {
      email,
      used_at: null,
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
  return tx.password_reset_otps.create({
    data: {
      user_id: userId ?? null,
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      last_sent_at: lastSentAt,
      attempts_count: 0,
    },
  });
}

async function findLatestActiveOtp(email) {
  const now = new Date();
  return prisma.password_reset_otps.findFirst({
    where: {
      email,
      used_at: null,
      reset_token_hash: null,
      expires_at: { gt: now },
    },
    orderBy: { created_at: 'desc' },
  });
}

async function findLatestOtpForCooldown(email) {
  return prisma.password_reset_otps.findFirst({
    where: { email },
    orderBy: { last_sent_at: 'desc' },
  });
}

async function incrementOtpAttempts(id, tx = prisma) {
  return tx.password_reset_otps.update({
    where: { id },
    data: {
      attempts_count: { increment: 1 },
      updated_at: new Date(),
    },
  });
}

async function storeResetToken(id, { resetTokenHash, resetTokenExpiresAt }, tx = prisma) {
  return tx.password_reset_otps.update({
    where: { id },
    data: {
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: resetTokenExpiresAt,
      updated_at: new Date(),
    },
  });
}

async function findValidResetSession(email, resetTokenHash) {
  const now = new Date();
  return prisma.password_reset_otps.findFirst({
    where: {
      email,
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: { gt: now },
      used_at: null,
    },
    orderBy: { created_at: 'desc' },
  });
}

async function markResetCompleted(id, tx = prisma) {
  const now = new Date();
  return tx.password_reset_otps.update({
    where: { id },
    data: {
      used_at: now,
      updated_at: now,
    },
  });
}

module.exports = {
  invalidateActiveOtpsForEmail,
  createOtpRecord,
  findLatestActiveOtp,
  findLatestOtpForCooldown,
  incrementOtpAttempts,
  storeResetToken,
  findValidResetSession,
  markResetCompleted,
};
