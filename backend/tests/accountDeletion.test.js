'use strict';

/**
 * Database-free unit tests for ACCOUNT-DELETION-COMPLIANCE-001.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const dbPath = require.resolve('../src/config/db');
const auditPath = require.resolve('../src/shared/services/audit.service');
const passwordPath = require.resolve('../src/utils/password');
const repoPath = require.resolve('../src/modules/accountDeletion/accountDeletion.repository');
const servicePath = require.resolve('../src/modules/accountDeletion/accountDeletion.service');
const {
  createDeletionRequestSchema,
  processDeletionRequestSchema,
  CONFIRMATION_PHRASE,
} = require('../src/modules/accountDeletion/accountDeletion.validation');

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

function loadService(mocks) {
  clearCache(servicePath);
  clearCache(repoPath);
  injectMock(dbPath, { prisma: mocks.prisma });
  injectMock(auditPath, { recordAudit: mocks.recordAudit });
  injectMock(passwordPath, {
    comparePassword: mocks.comparePassword,
    verifyPassword: mocks.comparePassword,
    hashPassword: async () => 'hash',
  });
  injectMock(repoPath, mocks.repo);
  return require(servicePath);
}

describe('accountDeletion.validation', () => {
  test('requires confirmation DELETE and currentPassword', () => {
    assert.equal(createDeletionRequestSchema.safeParse({}).success, false);
    assert.equal(
      createDeletionRequestSchema.safeParse({
        confirmation: 'delete',
        currentPassword: 'x',
      }).success,
      false
    );
    assert.equal(
      createDeletionRequestSchema.safeParse({
        confirmation: CONFIRMATION_PHRASE,
        currentPassword: 'secret',
        reason: 'privacy',
      }).success,
      true
    );
  });

  test('rejects unknown fields (strict)', () => {
    assert.equal(
      createDeletionRequestSchema.safeParse({
        confirmation: 'DELETE',
        currentPassword: 'x',
        user_id: 'evil',
      }).success,
      false
    );
  });

  test('process schema accepts processing|completed|rejected', () => {
    assert.equal(
      processDeletionRequestSchema.safeParse({
        status: 'completed',
        confirmation: 'DELETE',
      }).success,
      true
    );
    assert.equal(
      processDeletionRequestSchema.safeParse({
        status: 'cancelled',
        confirmation: 'DELETE',
      }).success,
      false
    );
  });
});

describe('accountDeletion.service', () => {
  let audits;

  beforeEach(() => {
    audits = [];
  });

  afterEach(() => {
    clearCache(servicePath);
    clearCache(repoPath);
    clearCache(dbPath);
    clearCache(auditPath);
    clearCache(passwordPath);
  });

  test('program_admin-only is fail-closed', async () => {
    const service = loadService({
      prisma: {},
      recordAudit: async () => null,
      comparePassword: async () => true,
      repo: {
        findActiveByUserId: async () => null,
        findLatestByUserId: async () => null,
      },
    });
    await assert.rejects(
      () =>
        service.getMyDeletionRequest({
          userId: 'u1',
          roles: ['program_admin'],
          isGlobal: false,
        }),
      (err) => err.code === 'ACCOUNT_DELETION_UNAVAILABLE'
    );
  });

  test('duplicate active request rejected', async () => {
    const service = loadService({
      prisma: {
        users: {
          findUnique: async () => ({
            id: 'u1',
            password_hash: 'h',
            primary_university_id: null,
          }),
        },
      },
      recordAudit: async (p) => {
        audits.push(p);
      },
      comparePassword: async () => true,
      repo: {
        findActiveByUserId: async () => ({
          id: 'r1',
          status: 'pending',
          user_id: 'u1',
        }),
      },
    });
    await assert.rejects(
      () =>
        service.createMyDeletionRequest(
          { userId: 'u1', roles: ['student'], universityId: null },
          { confirmation: 'DELETE', currentPassword: 'pw' }
        ),
      (err) => err.code === 'DELETION_REQUEST_ALREADY_EXISTS'
    );
    assert.equal(audits.length, 0);
  });

  test('invalid password rejected without creating request', async () => {
    let created = false;
    const service = loadService({
      prisma: {
        users: {
          findUnique: async () => ({
            id: 'u1',
            password_hash: 'h',
            primary_university_id: null,
          }),
        },
      },
      recordAudit: async (p) => audits.push(p),
      comparePassword: async () => false,
      repo: {
        findActiveByUserId: async () => null,
        createRequest: async () => {
          created = true;
          return {};
        },
      },
    });
    await assert.rejects(
      () =>
        service.createMyDeletionRequest(
          { userId: 'u1', roles: ['instructor'] },
          { confirmation: 'DELETE', currentPassword: 'wrong' }
        ),
      (err) => err.code === 'INVALID_PASSWORD'
    );
    assert.equal(created, false);
    assert.equal(audits.length, 0);
  });

  test('valid request succeeds and audits without password', async () => {
    const service = loadService({
      prisma: {
        users: {
          findUnique: async () => ({
            id: 'u1',
            password_hash: 'h',
            primary_university_id: 'uni-1',
          }),
        },
      },
      recordAudit: async (p) => audits.push(p),
      comparePassword: async () => true,
      repo: {
        findActiveByUserId: async () => null,
        createRequest: async ({ userId, reason }) => ({
          id: 'req-1',
          user_id: userId,
          status: 'pending',
          reason,
          requested_at: new Date('2026-08-06T10:00:00Z'),
          processed_at: null,
          cancelled_at: null,
        }),
      },
    });
    const out = await service.createMyDeletionRequest(
      { userId: 'u1', roles: ['student'], universityId: 'uni-1' },
      { confirmation: 'DELETE', currentPassword: 'secret', reason: 'privacy' }
    );
    assert.equal(out.request.status, 'pending');
    assert.equal(out.request.id, 'req-1');
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actionType, 'ACCOUNT_DELETION_REQUESTED');
    const serialized = JSON.stringify(audits[0]);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(serialized.includes('DELETE'), false);
  });

  test('cancel only allowed for pending', async () => {
    const service = loadService({
      prisma: {},
      recordAudit: async (p) => audits.push(p),
      comparePassword: async () => true,
      repo: {
        findActiveByUserId: async () => ({
          id: 'r1',
          status: 'processing',
          user_id: 'u1',
        }),
      },
    });
    await assert.rejects(
      () =>
        service.cancelMyDeletionRequest({
          userId: 'u1',
          roles: ['qa_officer'],
        }),
      (err) => err.code === 'DELETION_REQUEST_CANNOT_CANCEL'
    );
  });

  test('public mapper hides resolution_note', () => {
    const service = loadService({
      prisma: {},
      recordAudit: async () => null,
      comparePassword: async () => true,
      repo: {},
    });
    const pub = service.toPublicRequest({
      id: 'r1',
      status: 'rejected',
      reason: 'x',
      requested_at: new Date(),
      processed_at: new Date(),
      cancelled_at: null,
      resolution_note: 'internal secret',
      processed_by_id: 'admin-1',
    });
    assert.equal(pub.resolution_note, undefined);
    assert.equal(pub.processed_by_id, undefined);
    assert.equal(JSON.stringify(pub).includes('internal secret'), false);
  });

  test('getMine returns only own latest/active request shape', async () => {
    const service = loadService({
      prisma: {},
      recordAudit: async () => null,
      comparePassword: async () => true,
      repo: {
        findActiveByUserId: async (uid) => {
          assert.equal(uid, 'u-own');
          return {
            id: 'r-own',
            status: 'pending',
            reason: null,
            requested_at: new Date(),
            processed_at: null,
            cancelled_at: null,
          };
        },
      },
    });
    const out = await service.getMyDeletionRequest({
      userId: 'u-own',
      roles: ['university_admin'],
    });
    assert.equal(out.has_active_request, true);
    assert.equal(out.request.id, 'r-own');
  });

  test('all seven active roles are supported', () => {
    const service = loadService({
      prisma: {},
      recordAudit: async () => null,
      comparePassword: async () => true,
      repo: {},
    });
    for (const role of service.SUPPORTED_ROLES) {
      assert.doesNotThrow(() => service.assertDeletionAvailable([role]));
    }
  });
});
