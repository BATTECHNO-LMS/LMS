'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTtlCache } = require('../src/utils/lookupCache');
const {
  getPermissionCodesForRoleIds,
  clearRolePermissionCache,
} = require('../src/modules/auth/rolePermissionCache');
const { summarizeSql } = require('../src/config/queryTiming');
const { resolveDashboardKpiSet } = require('../src/modules/dashboard/dashboard.service');
const { summarizeDatabaseHost } = require('../src/config/prismaPoolUrl');

describe('lookupCache', () => {
  it('returns cached value within TTL and expires after', async () => {
    const cache = createTtlCache(20);
    cache.set('uni-1', { id: 'uni-1', name: 'X' });
    assert.equal(cache.get('uni-1').name, 'X');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(cache.get('uni-1'), undefined);
  });
});

describe('rolePermissionCache', () => {
  beforeEach(() => {
    clearRolePermissionCache();
  });

  it('loads missing role permissions once and reuses cache', async () => {
    let linkCalls = 0;
    let permCalls = 0;
    const prisma = {
      role_permissions: {
        findMany: async () => {
          linkCalls += 1;
          return [{ role_id: 'r1', permission_id: 'p1' }];
        },
      },
      permissions: {
        findMany: async () => {
          permCalls += 1;
          return [{ id: 'p1', code: 'users.view' }];
        },
      },
    };
    const first = await getPermissionCodesForRoleIds(prisma, ['r1']);
    const second = await getPermissionCodesForRoleIds(prisma, ['r1']);
    assert.deepEqual(first, ['users.view']);
    assert.deepEqual(second, ['users.view']);
    assert.equal(linkCalls, 1);
    assert.equal(permCalls, 1);
  });
});

describe('queryTiming', () => {
  it('summarizes SQL without keeping parameter payloads', () => {
    const sql = summarizeSql('SELECT id FROM users WHERE email = $1 AND otp = $2');
    assert.match(sql, /users/);
    assert.doesNotMatch(sql, /secret/);
  });
});

describe('resolveDashboardKpiSet', () => {
  it('uses institution KPIs for institution-scoped admins', () => {
    assert.equal(resolveDashboardKpiSet({ isGlobal: true, organizationType: 'INSTITUTION' }), 'global');
    assert.equal(resolveDashboardKpiSet({ isGlobal: false, organizationType: 'INSTITUTION' }), 'institution');
    assert.equal(resolveDashboardKpiSet({ isGlobal: false, organizationType: 'UNIVERSITY' }), 'university');
  });
});

describe('summarizeDatabaseHost', () => {
  it('detects neon pooler without exposing userinfo', () => {
    const info = summarizeDatabaseHost(
      'postgresql://app_user:s3cret@ep-foo-pooler.eu-central-1.aws.neon.tech/db?sslmode=require'
    );
    assert.equal(info.pooled_connection, true);
    assert.equal(info.provider, 'neon');
    assert.equal(info.region_hint, 'eu-central-1');
    assert.equal(info.host_kind, 'neon-pooler');
    assert.equal(JSON.stringify(info).includes('s3cret'), false);
  });
});