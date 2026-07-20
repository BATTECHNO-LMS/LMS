const repo = require('./mobilePush.repository');

function mapRegistration(row) {
  return {
    id: row.id,
    platform: row.platform,
    app_version: row.app_version,
    locale: row.locale,
    notification_permission_status: row.notification_permission_status,
    disabled_at: row.disabled_at,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Register (or re-register) a device push token for the authenticated user.
 * `userId` must come from `req.user.userId` (server-derived auth context) — never
 * from the request body — so a caller cannot register tokens for another account.
 */
async function registerDevice(userId, body) {
  const row = await repo.upsertByToken({
    userId,
    registrationToken: body.registration_token,
    platform: body.platform,
    appId: body.app_id,
    appVersion: body.app_version,
    deviceInstallationId: body.device_installation_id,
    locale: body.locale,
    permissionStatus: body.permission_status,
  });
  return { registration: mapRegistration(row) };
}

async function unregisterDevice(userId, registrationToken) {
  const result = await repo.deleteByTokenForUser(userId, registrationToken);
  return { removed_count: result.count };
}

async function unregisterAllDevices(userId) {
  const result = await repo.deleteAllForUser(userId);
  return { removed_count: result.count };
}

module.exports = {
  mapRegistration,
  registerDevice,
  unregisterDevice,
  unregisterAllDevices,
};
