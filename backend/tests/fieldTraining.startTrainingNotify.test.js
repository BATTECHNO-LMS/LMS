'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const dbPath = require.resolve('../src/config/db');
const notificationServicePath = require.resolve('../src/shared/services/notification.service');
const ftNotifyPath = require.resolve('../src/modules/fieldTraining/fieldTraining.notifications');

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

describe('notifyStudentsTrainingStarted', () => {
  beforeEach(() => {
    clearCache(ftNotifyPath);
    clearCache(notificationServicePath);
  });

  afterEach(() => {
    delete require.cache[dbPath];
    delete require.cache[notificationServicePath];
    delete require.cache[ftNotifyPath];
  });

  test('inserts unique student notifications in one createMany call', async () => {
    let received = null;
    injectMock(dbPath, {
      prisma: {
        notifications: {
          createMany: async ({ data }) => {
            received = data;
            return { count: data.length };
          },
        },
      },
    });
    injectMock(notificationServicePath, {
      createNotificationForUser: async () => {
        throw new Error('sequential fallback should not run');
      },
      userIdsByRoleCodes: async () => [],
    });

    const ftNotify = require(ftNotifyPath);
    const result = await ftNotify.notifyStudentsTrainingStarted({
      studentIds: ['u1', 'u1', 'u2', null],
      opportunityId: 'opp-1',
      opportunityTitle: 'Zarqa',
    });

    assert.equal(result.created_count, 2);
    assert.equal(received.length, 2);
    assert.deepEqual(
      received.map((row) => row.user_id),
      ['u1', 'u2']
    );
    assert.equal(received[0].type, 'success');
    assert.equal(received[0].action_url, '/student/field-training/opp-1?tab=overview');
    assert.match(received[0].body, /Zarqa/);
  });

  test('falls back to sequential create when createMany fails', async () => {
    const created = [];
    injectMock(dbPath, {
      prisma: {
        notifications: {
          createMany: async () => {
            throw new Error('enum mismatch');
          },
        },
      },
    });
    injectMock(notificationServicePath, {
      createNotificationForUser: async ({ userId }) => {
        created.push(userId);
        return { id: userId };
      },
      userIdsByRoleCodes: async () => [],
    });

    const ftNotify = require(ftNotifyPath);
    const result = await ftNotify.notifyStudentsTrainingStarted({
      studentIds: ['u1', 'u2'],
      opportunityId: 'opp-1',
      opportunityTitle: 'Zarqa',
    });

    assert.equal(result.created_count, 2);
    assert.deepEqual(created, ['u1', 'u2']);
  });
});
