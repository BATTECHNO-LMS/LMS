'use strict';

const { prisma } = require('../../config/db');

const ACTIVE_STATUSES = ['pending', 'processing'];

async function findActiveByUserId(userId) {
  return prisma.account_deletion_requests.findFirst({
    where: {
      user_id: userId,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { requested_at: 'desc' },
  });
}

async function findLatestByUserId(userId) {
  return prisma.account_deletion_requests.findFirst({
    where: { user_id: userId },
    orderBy: { requested_at: 'desc' },
  });
}

async function createRequest({ userId, reason }) {
  return prisma.account_deletion_requests.create({
    data: {
      user_id: userId,
      status: 'pending',
      reason: reason || null,
      requested_at: new Date(),
    },
  });
}

async function cancelRequest(id) {
  const now = new Date();
  return prisma.account_deletion_requests.update({
    where: { id },
    data: {
      status: 'cancelled',
      cancelled_at: now,
      updated_at: now,
    },
  });
}

async function findById(id) {
  return prisma.account_deletion_requests.findUnique({ where: { id } });
}

async function listRequests({ status, take = 50, skip = 0 } = {}) {
  return prisma.account_deletion_requests.findMany({
    where: status ? { status } : undefined,
    orderBy: { requested_at: 'desc' },
    take: Math.min(Math.max(take, 1), 100),
    skip: Math.max(skip, 0),
  });
}

async function updateRequestStatus(id, { status, processedById, resolutionNote }) {
  const now = new Date();
  return prisma.account_deletion_requests.update({
    where: { id },
    data: {
      status,
      processed_at: now,
      processed_by_id: processedById,
      resolution_note: resolutionNote ?? null,
      updated_at: now,
    },
  });
}

/**
 * Anonymize identity fields on the user row. Does not delete academic records.
 * Email remains unique via a tombstone address.
 */
async function anonymizeUserIdentity(userId, tx = prisma) {
  const tombstoneEmail = `deleted+${userId.replace(/-/g, '')}@deleted.local`;
  const now = new Date();
  return tx.users.update({
    where: { id: userId },
    data: {
      full_name: 'Deleted User',
      email: tombstoneEmail,
      phone: null,
      // Unusable hash — login impossible after completion.
      password_hash: `deleted:${userId}:${now.getTime()}`,
      status: 'inactive',
      updated_at: now,
    },
  });
}

async function deleteUserOtps(userId, tx = prisma) {
  await tx.email_verification_otps.deleteMany({ where: { user_id: userId } });
  await tx.password_reset_otps.deleteMany({ where: { user_id: userId } });
}

async function disablePushRegistrations(userId, tx = prisma) {
  try {
    await tx.mobile_push_registrations.updateMany({
      where: { user_id: userId, disabled_at: null },
      data: { disabled_at: new Date(), updated_at: new Date() },
    });
  } catch (err) {
    // Table may be absent on older DBs — ignore.
    if (err?.code !== 'P2021') throw err;
  }
}

module.exports = {
  ACTIVE_STATUSES,
  findActiveByUserId,
  findLatestByUserId,
  createRequest,
  cancelRequest,
  findById,
  listRequests,
  updateRequestStatus,
  anonymizeUserIdentity,
  deleteUserOtps,
  disablePushRegistrations,
};
