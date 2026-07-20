'use strict';

/**
 * Database-free unit tests for MOBILE-PHASE-25 push notifications.
 * Uses require.cache injection to fake `config/db` / module dependencies —
 * no live Postgres and no live Firebase project are needed.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const dbPath = require.resolve('../src/config/db');
const mobilePushRepoPath = require.resolve('../src/modules/mobilePush/mobilePush.repository');
const mobilePushServicePath = require.resolve('../src/modules/mobilePush/mobilePush.service');
const pushNotificationServicePath = require.resolve('../src/services/pushNotification.service');
const notificationServicePath = require.resolve('../src/shared/services/notification.service');
const {
  registerPushSchema,
  unregisterPushSchema,
} = require('../src/modules/mobilePush/mobilePush.validation');

function injectMock(modulePath, exportsObj) {
  const fake = new Module(modulePath);
  fake.filename = modulePath;
  fake.exports = exportsObj;
  fake.loaded = true;
  require.cache[modulePath] = fake;
}

function clearCache(modulePath) {
  delete require.cache[modulePath];
}

const PUSH_ENV_KEYS = [
  'FIREBASE_PUSH_ENABLED',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_SERVICE_ACCOUNT_BASE64',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'PUSH_GENERIC_LOCK_SCREEN',
];

describe('mobilePush.validation', () => {
  test('register schema requires registration_token and platform', () => {
    const result = registerPushSchema.safeParse({ platform: 'android' });
    assert.equal(result.success, false);
  });

  test('register schema rejects unknown platform values', () => {
    const result = registerPushSchema.safeParse({
      registration_token: 'tok-123',
      platform: 'windows',
    });
    assert.equal(result.success, false);
  });

  test('register schema accepts android/ios with optional fields', () => {
    const result = registerPushSchema.safeParse({
      registration_token: 'tok-123',
      platform: 'ios',
      app_version: '1.2.3',
      locale: 'ar',
      permission_status: 'granted',
      app_id: 'com.battechno.battechnoLmsApp',
      device_installation_id: 'device-abc',
    });
    assert.equal(result.success, true);
  });

  test('register schema rejects unknown extra fields (strict)', () => {
    const result = registerPushSchema.safeParse({
      registration_token: 'tok-123',
      platform: 'android',
      unexpected_field: 'nope',
    });
    assert.equal(result.success, false);
  });

  test('register schema rejects empty token', () => {
    const result = registerPushSchema.safeParse({ registration_token: '', platform: 'android' });
    assert.equal(result.success, false);
  });

  test('unregister schema requires registration_token only', () => {
    assert.equal(unregisterPushSchema.safeParse({}).success, false);
    assert.equal(
      unregisterPushSchema.safeParse({ registration_token: 'tok-123' }).success,
      true
    );
  });
});

describe('mobilePush.repository (mocked prisma)', () => {
  afterEach(() => {
    clearCache(mobilePushRepoPath);
    clearCache(dbPath);
  });

  test('upsertByToken keys by registration_token and clears disabled_at on reassignment', async () => {
    let capturedArgs = null;
    injectMock(dbPath, {
      prisma: {
        mobile_push_registrations: {
          upsert: async (args) => {
            capturedArgs = args;
            return { id: 'row-1', ...args.create };
          },
        },
      },
    });
    clearCache(mobilePushRepoPath);
    const repo = require(mobilePushRepoPath);

    await repo.upsertByToken({
      userId: 'user-2',
      registrationToken: 'tok-shared',
      platform: 'android',
    });

    assert.equal(capturedArgs.where.registration_token, 'tok-shared');
    assert.equal(capturedArgs.create.user_id, 'user-2');
    assert.equal(capturedArgs.update.user_id, 'user-2');
    assert.equal(capturedArgs.update.disabled_at, null);
    assert.equal(capturedArgs.update.last_delivery_error, null);
  });

  test('deleteByTokenForUser scopes deletion to the requesting user', async () => {
    let capturedArgs = null;
    injectMock(dbPath, {
      prisma: {
        mobile_push_registrations: {
          deleteMany: async (args) => {
            capturedArgs = args;
            return { count: 1 };
          },
        },
      },
    });
    clearCache(mobilePushRepoPath);
    const repo = require(mobilePushRepoPath);

    const result = await repo.deleteByTokenForUser('user-1', 'tok-1');
    assert.deepEqual(capturedArgs.where, { user_id: 'user-1', registration_token: 'tok-1' });
    assert.equal(result.count, 1);
  });

  test('disableById sets disabled_at', async () => {
    let capturedArgs = null;
    injectMock(dbPath, {
      prisma: {
        mobile_push_registrations: {
          update: async (args) => {
            capturedArgs = args;
            return { id: args.where.id, disabled_at: args.data.disabled_at };
          },
        },
      },
    });
    clearCache(mobilePushRepoPath);
    const repo = require(mobilePushRepoPath);

    await repo.disableById('row-9');
    assert.equal(capturedArgs.where.id, 'row-9');
    assert.ok(capturedArgs.data.disabled_at instanceof Date);
  });

  test('recordDeliveryError truncates long messages and never stores tokens', async () => {
    let capturedArgs = null;
    injectMock(dbPath, {
      prisma: {
        mobile_push_registrations: {
          update: async (args) => {
            capturedArgs = args;
            return { id: args.where.id };
          },
        },
      },
    });
    clearCache(mobilePushRepoPath);
    const repo = require(mobilePushRepoPath);

    const longMessage = 'x'.repeat(1000);
    await repo.recordDeliveryError('row-9', longMessage);
    assert.equal(capturedArgs.data.last_delivery_error.length, 500);
  });
});

describe('mobilePush.service (mocked repository)', () => {
  afterEach(() => {
    clearCache(mobilePushServicePath);
    clearCache(mobilePushRepoPath);
  });

  test('registerDevice always uses the authenticated userId, never a body-supplied id', async () => {
    let capturedArgs = null;
    injectMock(mobilePushRepoPath, {
      upsertByToken: async (args) => {
        capturedArgs = args;
        return {
          id: 'row-1',
          platform: args.platform,
          app_version: args.appVersion ?? null,
          locale: args.locale ?? null,
          notification_permission_status: args.permissionStatus ?? null,
          disabled_at: null,
          last_seen_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
    });
    clearCache(mobilePushServicePath);
    const service = require(mobilePushServicePath);

    const result = await service.registerDevice('user-authenticated', {
      registration_token: 'tok-x',
      platform: 'android',
      user_id: 'attacker-supplied-id',
    });

    assert.equal(capturedArgs.userId, 'user-authenticated');
    assert.equal(result.registration.platform, 'android');
    assert.equal('registration_token' in result.registration, false);
  });

  test('unregisterDevice scopes to the current user and returns removed_count', async () => {
    let capturedArgs = null;
    injectMock(mobilePushRepoPath, {
      deleteByTokenForUser: async (userId, token) => {
        capturedArgs = { userId, token };
        return { count: 1 };
      },
    });
    clearCache(mobilePushServicePath);
    const service = require(mobilePushServicePath);

    const result = await service.unregisterDevice('user-1', 'tok-1');
    assert.deepEqual(capturedArgs, { userId: 'user-1', token: 'tok-1' });
    assert.equal(result.removed_count, 1);
  });

  test('unregisterAllDevices removes every registration for the user', async () => {
    injectMock(mobilePushRepoPath, {
      deleteAllForUser: async () => ({ count: 3 }),
    });
    clearCache(mobilePushServicePath);
    const service = require(mobilePushServicePath);

    const result = await service.unregisterAllDevices('user-1');
    assert.equal(result.removed_count, 3);
  });
});

describe('pushNotification.service (disabled by default / privacy helpers)', () => {
  let savedEnv;
  let pushService;

  beforeEach(() => {
    savedEnv = {};
    for (const key of PUSH_ENV_KEYS) savedEnv[key] = process.env[key];
    for (const key of PUSH_ENV_KEYS) delete process.env[key];
    clearCache(pushNotificationServicePath);
    pushService = require(pushNotificationServicePath);
    pushService._resetForTests();
  });

  afterEach(() => {
    for (const key of PUSH_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    pushService._resetForTests();
  });

  test('isEnabled() is false when FIREBASE_PUSH_ENABLED is unset', () => {
    assert.equal(pushService.isEnabled(), false);
  });

  test('isEnabled() is false when enabled but no credentials are configured', () => {
    process.env.FIREBASE_PUSH_ENABLED = 'true';
    assert.equal(pushService.isEnabled(), false);
  });

  test('isEnabled() is false (never throws) when service-account JSON is malformed', () => {
    process.env.FIREBASE_PUSH_ENABLED = 'true';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{ this is not valid json';
    assert.doesNotThrow(() => pushService.isEnabled());
    assert.equal(pushService.isEnabled(), false);
  });

  test('requiring the module never throws regardless of env', () => {
    assert.doesNotThrow(() => {
      clearCache(pushNotificationServicePath);
      require(pushNotificationServicePath);
    });
  });

  test('sendToUser resolves a safe no-op when disabled (no repository lookup)', async () => {
    const result = await pushService.sendToUser('user-1', { notificationId: 'n1' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'disabled');
    assert.equal(result.sent, 0);
  });

  test('sendToUser resolves a safe no-op for a missing userId', async () => {
    const result = await pushService.sendToUser(undefined, { notificationId: 'n1' });
    assert.equal(result.ok, false);
    assert.equal(result.sent, 0);
  });

  test('buildDataPayload only carries the privacy allowlist', () => {
    const data = pushService.buildDataPayload({
      notificationId: 'notif-1',
      type: 'enrollment_approved',
      actionUrl: '/student/programs',
    });
    assert.deepEqual(Object.keys(data).sort(), [
      'action_url',
      'event_version',
      'notification_id',
      'notification_type',
    ]);
    assert.equal(data.notification_id, 'notif-1');
    assert.equal(data.action_url, '/student/programs');
  });

  test('buildDataPayload truncates an overlong action_url', () => {
    const longUrl = `/x${'y'.repeat(3000)}`;
    const data = pushService.buildDataPayload({ notificationId: 'n1', actionUrl: longUrl });
    assert.equal(data.action_url.length, 2000);
  });

  test('buildAlertPayload uses the provided title/body by default', () => {
    const alert = pushService.buildAlertPayload({ title: 'تم قبول طلب التسجيل', body: 'body text' });
    assert.equal(alert.title, 'تم قبول طلب التسجيل');
    assert.equal(alert.body, 'body text');
  });

  test('buildAlertPayload falls back to a locale-aware generic alert when forced', () => {
    process.env.PUSH_GENERIC_LOCK_SCREEN = 'true';
    const arAlert = pushService.buildAlertPayload({ title: 'secret', body: 'secret body', locale: 'ar' });
    const enAlert = pushService.buildAlertPayload({ title: 'secret', body: 'secret body', locale: 'en' });
    assert.equal(arAlert.title.includes('BATTECHNO'), true);
    assert.notEqual(enAlert.title, arAlert.title);
  });
});

describe('createNotificationForUser push fanout (mocked db + push service)', () => {
  afterEach(() => {
    clearCache(notificationServicePath);
    clearCache(dbPath);
    clearCache(pushNotificationServicePath);
  });

  test('does not throw or reject when push delivery fails', async () => {
    const fakeRow = {
      id: 'notif-1',
      user_id: 'user-1',
      title: 'Test title',
      body: 'Test body',
      action_url: null,
      type: 'info',
    };
    injectMock(dbPath, {
      prisma: {
        notifications: {
          findFirst: async () => null,
          create: async () => fakeRow,
        },
      },
    });
    injectMock(pushNotificationServicePath, {
      sendToUser: async () => {
        throw new Error('simulated FCM outage');
      },
    });
    clearCache(notificationServicePath);
    const notificationService = require(notificationServicePath);

    const row = await notificationService.createNotificationForUser({
      userId: 'user-1',
      title: 'Test title',
      body: 'Test body',
    });

    assert.equal(row.id, 'notif-1');

    // Fanout runs via setImmediate; flush the event loop and assert no unhandled rejection occurred.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });

  test('createNotificationsForUsers passes actionUrl through to each created row', async () => {
    const created = [];
    injectMock(dbPath, {
      prisma: {
        notifications: {
          findFirst: async () => null,
          create: async ({ data }) => {
            const row = { id: `notif-${created.length + 1}`, ...data };
            created.push(row);
            return row;
          },
        },
      },
    });
    injectMock(pushNotificationServicePath, {
      sendToUser: async () => ({ ok: true, sent: 0 }),
    });
    clearCache(notificationServicePath);
    const notificationService = require(notificationServicePath);

    await notificationService.createNotificationsForUsers({
      userIds: ['user-1', 'user-2'],
      title: 'Broadcast',
      body: 'Body',
      type: 'info',
      actionUrl: '/admin/enrollments?status=pending',
    });

    assert.equal(created.length, 2);
    for (const row of created) {
      assert.equal(row.action_url, '/admin/enrollments?status=pending');
    }
  });
});
