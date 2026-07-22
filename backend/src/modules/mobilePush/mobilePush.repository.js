const { prisma } = require('../../config/db');

/**
 * Upsert a device registration keyed by `registration_token`.
 * Tokens are globally unique (a device/app install token belongs to exactly one
 * account at a time); re-registering under a different user reassigns ownership
 * and clears any previous disablement.
 */
async function upsertByToken({
  userId,
  registrationToken,
  platform,
  appId,
  appVersion,
  deviceInstallationId,
  locale,
  permissionStatus,
}) {
  const now = new Date();
  const sharedData = {
    user_id: userId,
    platform,
    app_id: appId ?? null,
    app_version: appVersion ?? null,
    device_installation_id: deviceInstallationId ?? null,
    locale: locale ?? null,
    notification_permission_status: permissionStatus ?? null,
    updated_at: now,
    last_seen_at: now,
    disabled_at: null,
    last_delivery_error: null,
    last_delivery_error_at: null,
  };

  return prisma.mobile_push_registrations.upsert({
    where: { registration_token: registrationToken },
    create: {
      registration_token: registrationToken,
      ...sharedData,
    },
    update: sharedData,
  });
}

async function deleteByTokenForUser(userId, registrationToken) {
  return prisma.mobile_push_registrations.deleteMany({
    where: { user_id: userId, registration_token: registrationToken },
  });
}

async function deleteAllForUser(userId) {
  return prisma.mobile_push_registrations.deleteMany({
    where: { user_id: userId },
  });
}

async function findActiveByUserId(userId) {
  return prisma.mobile_push_registrations.findMany({
    where: { user_id: userId, disabled_at: null },
  });
}

async function disableById(id) {
  return prisma.mobile_push_registrations.update({
    where: { id },
    data: { disabled_at: new Date() },
  });
}

async function recordDeliveryError(id, message) {
  return prisma.mobile_push_registrations.update({
    where: { id },
    data: {
      last_delivery_error: String(message || '').slice(0, 500),
      last_delivery_error_at: new Date(),
    },
  });
}

async function findStale({ olderThan, includeDisabled = true }) {
  return prisma.mobile_push_registrations.findMany({
    where: {
      OR: [
        { last_seen_at: { lt: olderThan } },
        includeDisabled ? { disabled_at: { not: null } } : undefined,
      ].filter(Boolean),
    },
  });
}

module.exports = {
  upsertByToken,
  deleteByTokenForUser,
  deleteAllForUser,
  findActiveByUserId,
  disableById,
  recordDeliveryError,
  findStale,
};
