'use strict';

/**
 * Identity lifecycle: JWT minting helpers + current-state auth revalidation
 * (IDENTITY-002 / IDENTITY-003).
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { ZodError } = require('zod');
const { authenticate } = require('../src/middlewares/auth.middleware');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { signToken } = require('../src/utils/jwt');
const { isGlobalFromRoleRecords, buildTokenPayload } = require('../src/modules/auth/auth.service');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const {
  createUserBodySchema,
  updateUserBodySchema,
  patchUserStatusBodySchema,
} = require('../src/modules/users/users.validation');
const { registerSchema, loginSchema } = require('../src/modules/auth/auth.validation');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  makeRequester,
  createMockReq,
  runMiddlewareAsync,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

function bearerReq(token) {
  return createMockReq({
    headers: { authorization: token ? `Bearer ${token}` : undefined },
  });
}

function roleRec(code) {
  return { code };
}

describe('isGlobalFromRoleRecords (login derivation)', () => {
  it('true when role records include super_admin', () => {
    assert.equal(isGlobalFromRoleRecords([roleRec('super_admin')]), true);
    assert.equal(isGlobalFromRoleRecords([roleRec('student'), roleRec('Super_Admin')]), true);
  });

  it('false for program_admin alone', () => {
    assert.equal(isGlobalFromRoleRecords([roleRec('program_admin')]), false);
  });

  it('false for empty / non-super roles', () => {
    assert.equal(isGlobalFromRoleRecords([]), false);
    assert.equal(isGlobalFromRoleRecords([roleRec('university_admin'), roleRec('instructor')]), false);
  });
});

describe('buildTokenPayload privileged claims', () => {
  it('super_admin → isGlobal true and roles list', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('super_admin')], null);
    assert.equal(payload.userId, SYNTH_USER_A);
    assert.deepEqual(payload.roles, ['super_admin']);
    assert.equal(payload.universityId, null);
    assert.equal(payload.isGlobal, true);
  });

  it('super_admin with university still isGlobal true', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('super_admin')], SYNTH_UNI_A);
    assert.equal(payload.isGlobal, true);
    assert.equal(payload.universityId, SYNTH_UNI_A);
  });

  it('program_admin → isGlobal false with universityId', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('program_admin')], SYNTH_UNI_A);
    assert.equal(payload.isGlobal, false);
    assert.deepEqual(payload.roles, ['program_admin']);
    assert.equal(payload.universityId, SYNTH_UNI_A);
  });

  it('scoped student without university → universityId null, isGlobal false', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('student')], null);
    assert.equal(payload.isGlobal, false);
    assert.equal(payload.universityId, null);
  });

  it('unknown role codes are passed through; isGlobal false', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('employer_unknown')], SYNTH_UNI_A);
    assert.deepEqual(payload.roles, ['employer_unknown']);
    assert.equal(payload.isGlobal, false);
  });

  it('does not include status/active/permissions in JWT payload', () => {
    const payload = buildTokenPayload(SYNTH_USER_A, [roleRec('student')], SYNTH_UNI_A);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'status'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'permissions'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'active'), false);
  });
});

describe('authenticate uses current DB context (IDENTITY-002/003)', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('does not honor forged token isGlobal when current DB context is non-global', async () => {
    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: true,
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, false);
    assert.deepEqual(req.user.roles, ['student']);
  });

  it('current DB super_admin yields isGlobal even when token claim is false', async () => {
    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['super_admin'],
      universityId: null,
      isGlobal: true,
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['super_admin'],
      universityId: null,
      isGlobal: false,
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, true);
  });

  it('program_admin from current DB stays non-global', async () => {
    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['program_admin'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['program_admin'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, false);
  });

  it('inactive current user is rejected (IDENTITY-003)', async () => {
    const { ApiError } = require('../src/utils/apiError');
    setCurrentAuthContextLoaderForTests(async () => {
      throw new ApiError(403, 'Account is inactive or suspended', null, 'ACCOUNT_INACTIVE');
    });
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq(token));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'ACCOUNT_INACTIVE');
  });
});

describe('authorizeRoles + privileged claims', () => {
  it('isGlobal bypasses allowlist', () => {
    const mw = authorizeRoles('super_admin');
    const out = runMiddlewareSync(
      mw,
      createMockReq({ user: makeRequester({ roles: ['student'], isGlobal: true }) })
    );
    assert.equal(out.nextCalled, true);
  });

  it('non-global student with isGlobal claim shape false is forbidden for super_admin route', () => {
    const mw = authorizeRoles('super_admin');
    const out = runMiddlewareSync(
      mw,
      createMockReq({ user: makeRequester({ roles: ['student'], isGlobal: false }) })
    );
    assert.equal(out.status, 403);
  });

  it('program_admin still needs allowlist membership when not isGlobal', () => {
    const mw = authorizeRoles('super_admin');
    const out = runMiddlewareSync(
      mw,
      createMockReq({ user: makeRequester({ roles: ['program_admin'], isGlobal: false }) })
    );
    assert.equal(out.status, 403);
  });

  it('malformed user.roles non-array treated as empty → 403 when not global', () => {
    const mw = authorizeRoles('student');
    const out = runMiddlewareSync(
      mw,
      createMockReq({ user: { userId: SYNTH_USER_A, roles: null, isGlobal: false } })
    );
    assert.equal(out.status, 403);
  });
});

describe('mass-assignment: validators reject privileged fields', () => {
  const privilegedExtras = {
    isGlobal: true,
    is_global: true,
    roles: ['super_admin'],
    role: 'super_admin',
    permissions: ['*'],
    permissionCodes: ['ui.all'],
    userId: SYNTH_USER_A,
    universityId: SYNTH_UNI_A,
  };

  it('registerSchema rejects isGlobal / roles / permissions extras', () => {
    assert.throws(
      () =>
        registerSchema.parse({
          full_name: 'Test User',
          email: 'student@example.com',
          password: 'secret1',
          university_id: SYNTH_UNI_A,
          university_specialty_id: SYNTH_UNI_A,
          ...privilegedExtras,
        }),
      ZodError
    );
  });

  it('loginSchema rejects isGlobal injection', () => {
    assert.throws(
      () =>
        loginSchema.parse({
          email: 'a@example.com',
          password: 'x',
          isGlobal: true,
          roles: ['super_admin'],
        }),
      ZodError
    );
  });

  it('createUserBodySchema rejects isGlobal / permissions but accepts role_codes', () => {
    assert.throws(
      () =>
        createUserBodySchema.parse({
          full_name: 'Admin Create',
          email: 'admin-create@example.com',
          password: 'secret1',
          role_codes: ['instructor'],
          isGlobal: true,
        }),
      ZodError
    );
    const ok = createUserBodySchema.parse({
      full_name: 'Admin Create',
      email: 'admin-create@example.com',
      password: 'secret1',
      role_codes: ['super_admin', 'program_admin'],
    });
    assert.deepEqual(ok.role_codes, ['super_admin', 'program_admin']);
    assert.equal(Object.prototype.hasOwnProperty.call(ok, 'isGlobal'), false);
  });

  it('updateUserBodySchema rejects isGlobal; accepts role_codes including super_admin', () => {
    assert.throws(
      () => updateUserBodySchema.parse({ role_codes: ['student'], isGlobal: true }),
      ZodError
    );
    const ok = updateUserBodySchema.parse({ role_codes: ['super_admin'] });
    assert.deepEqual(ok.role_codes, ['super_admin']);
  });

  it('patchUserStatusBodySchema rejects role / isGlobal', () => {
    assert.throws(
      () => patchUserStatusBodySchema.parse({ status: 'active', isGlobal: true }),
      ZodError
    );
    assert.throws(
      () => patchUserStatusBodySchema.parse({ status: 'inactive', role_codes: ['super_admin'] }),
      ZodError
    );
  });

  it('createUserBodySchema documents status as assignable enum (not isGlobal)', () => {
    const ok = createUserBodySchema.parse({
      full_name: 'X',
      email: 'x@example.com',
      password: 'secret1',
      role_codes: ['student'],
      status: 'inactive',
    });
    assert.equal(ok.status, 'inactive');
  });
});

describe('stale JWT claims no longer authorize (IDENTITY-002)', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('old elevated JWT isGlobal does not bypass authorizeRoles when DB roles are normal', async () => {
    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: true,
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    const out = runMiddlewareSync(authorizeRoles('super_admin'), req);
    assert.equal(out.status, 403);
  });

  it('current DB university overrides stale token universityId', async () => {
    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['university_admin'],
      universityId: SYNTH_UNI_B,
      isGlobal: false,
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['university_admin'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.universityId, SYNTH_UNI_B);
  });
});
