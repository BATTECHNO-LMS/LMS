'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  createAuthContextCache,
  cacheKey,
  clampTtl,
  DEFAULT_TTL_MS,
} = require('../src/modules/auth/authContextCache');
const {
  loadCurrentAuthContext,
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const { isGlobalFromRoleRecords } = require('../src/modules/auth/auth.service');
const { applyPortalScope } = require('../src/modules/auth/portalAccess');

describe('authContextCache', () => {
  it('clampTtl treats 0 as disabled and bounds positive values', () => {
    assert.equal(clampTtl(0), 0);
    assert.equal(clampTtl('0'), 0);
    assert.equal(clampTtl(1000), 5000);
    assert.equal(clampTtl(120000), 60000);
    assert.equal(clampTtl(undefined), DEFAULT_TTL_MS);
  });

  it('get/set clones values and keys by user + portal', () => {
    const cache = createAuthContextCache({ ttlMs: 15_000, maxEntries: 8 });
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const ctx = { userId, roles: ['student'], universityId: 'u1' };
    cache.set(userId, 'UNIVERSITY', ctx);
    ctx.roles.push('admin');
    const hit = cache.get(userId, 'UNIVERSITY');
    assert.deepEqual(hit.roles, ['student']);
    assert.equal(cache.get(userId, 'INSTITUTION'), undefined);
  });

  it('invalidateUser removes both portal keys', () => {
    const cache = createAuthContextCache({ ttlMs: 15_000, maxEntries: 8 });
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    cache.set(userId, 'UNIVERSITY', { userId, roles: ['admin'] });
    cache.set(userId, 'INSTITUTION', { userId, roles: ['admin'] });
    cache.invalidateUser(userId);
    assert.equal(cache.get(userId, 'UNIVERSITY'), undefined);
    assert.equal(cache.get(userId, 'INSTITUTION'), undefined);
  });

  it('evicts oldest entries when over max size', () => {
    const cache = createAuthContextCache({ ttlMs: 15_000, maxEntries: 2 });
    cache.set('a', 'UNIVERSITY', { userId: 'a' });
    cache.set('b', 'UNIVERSITY', { userId: 'b' });
    cache.set('c', 'UNIVERSITY', { userId: 'c' });
    assert.equal(cache.size(), 2);
    assert.equal(cache.get('a', 'UNIVERSITY'), undefined);
    assert.equal(cache.get('c', 'UNIVERSITY').userId, 'c');
  });

  it('ttl 0 stores nothing', () => {
    const cache = createAuthContextCache({ ttlMs: 0, maxEntries: 8 });
    cache.set('a', 'UNIVERSITY', { userId: 'a', roles: ['student'] });
    assert.equal(cache.get('a', 'UNIVERSITY'), undefined);
    assert.equal(cache.size(), 0);
  });

  it('warm get does not require a second load', async () => {
    const cache = createAuthContextCache({ ttlMs: 15_000, maxEntries: 8 });
    const userId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    let loads = 0;
    async function loadFromDb() {
      loads += 1;
      return { userId, roles: ['student'], isGlobal: false };
    }
    async function resolve() {
      const hit = cache.get(userId, 'UNIVERSITY');
      if (hit) return hit;
      const value = await loadFromDb();
      cache.set(userId, 'UNIVERSITY', value);
      return value;
    }
    await resolve();
    await resolve();
    assert.equal(loads, 1);
  });
});

describe('auth context cache is skipped for test loaders', () => {
  beforeEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('injected loader is used on every call (no stale mock)', async () => {
    const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    setCurrentAuthContextLoaderForTests(async () => ({
      userId,
      roles: ['student'],
      isGlobal: false,
    }));
    const first = await loadCurrentAuthContext(userId, { portalType: 'UNIVERSITY' });
    assert.deepEqual(first.roles, ['student']);

    setCurrentAuthContextLoaderForTests(async () => ({
      userId,
      roles: ['super_admin'],
      isGlobal: true,
    }));
    const second = await loadCurrentAuthContext(userId, { portalType: 'UNIVERSITY' });
    assert.deepEqual(second.roles, ['super_admin']);
    assert.equal(second.isGlobal, true);
  });
});

describe('super_admin and portal scope semantics (unchanged)', () => {
  it('isGlobal is true only from super_admin role records', () => {
    assert.equal(isGlobalFromRoleRecords([{ code: 'super_admin' }]), true);
    assert.equal(isGlobalFromRoleRecords([{ code: 'admin' }]), false);
    assert.equal(isGlobalFromRoleRecords([]), false);
  });

  it('missing organization does not become global', () => {
    const scoped = applyPortalScope(
      {
        userId: 'x',
        roles: ['admin'],
        isGlobal: false,
        organizationType: null,
        organizationId: null,
        universityId: 'u1',
        primaryUniversityId: 'u1',
        university: { id: 'u1', name: 'Uni' },
      },
      'UNIVERSITY'
    );
    assert.equal(scoped.isGlobal, false);
    assert.deepEqual(scoped.roles, ['admin']);
  });

  it('reviewer remains a university portal role and is stripped on institution portal', () => {
    const uni = applyPortalScope(
      {
        userId: 'r',
        roles: ['reviewer'],
        isGlobal: false,
        universityId: 'u1',
        primaryUniversityId: 'u1',
        university: { id: 'u1', name: 'Uni' },
        organizationType: 'UNIVERSITY',
        organizationId: 'o1',
      },
      'UNIVERSITY'
    );
    assert.deepEqual(uni.roles, ['reviewer']);
    const inst = applyPortalScope(
      {
        ...uni,
        roles: ['reviewer'],
      },
      'INSTITUTION'
    );
    assert.deepEqual(inst.roles, []);
    assert.equal(inst.universityId, null);
  });

  it('cacheKey distinguishes portals', () => {
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    assert.notEqual(cacheKey(id, 'UNIVERSITY'), cacheKey(id, 'INSTITUTION'));
  });
});
