'use strict';

/**
 * IDENTITY-002 / IDENTITY-003: current-state auth revalidation after JWT verify.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../src/middlewares/auth.middleware');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { signToken } = require('../src/utils/jwt');
const { env } = require('../src/config/env');
const { ApiError } = require('../src/utils/apiError');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
  loadCurrentAuthContext,
} = require('../src/modules/auth/currentAuthContext');
const {
  assertSuperAdminRoleMutationAllowed,
  FORBIDDEN_CODE,
} = require('../src/modules/users/superAdminPrivilegeBoundary');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  createMockReq,
  runMiddlewareAsync,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

function secret() {
  return env.JWT_SECRET || 'battechno-dev-only-change-me';
}

function bearerReq(token) {
  return createMockReq({
    headers: { authorization: token ? `Bearer ${token}` : undefined },
  });
}

function tokenFor(overrides = {}) {
  return signToken({
    userId: SYNTH_USER_A,
    roles: ['student'],
    universityId: SYNTH_UNI_A,
    isGlobal: false,
    portalType: 'UNIVERSITY',
    ...overrides,
  });
}

function mockActive(ctx) {
  setCurrentAuthContextLoaderForTests(async (userId) => {
    assert.equal(userId, SYNTH_USER_A);
    return {
      userId,
      roles: ctx.roles ?? ['student'],
      universityId: ctx.universityId === undefined ? SYNTH_UNI_A : ctx.universityId,
      isGlobal: Boolean(ctx.isGlobal),
    };
  });
}

describe('IDENTITY-002/003 current auth revalidation', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('valid token + active current user + unchanged roles → allowed', async () => {
    mockActive({ roles: ['instructor'], universityId: SYNTH_UNI_A, isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['instructor'], universityId: SYNTH_UNI_A }));
    const out = await runMiddlewareAsync(authenticate, req);
    assert.equal(out.nextCalled, true);
    assert.deepEqual(req.user.roles, ['instructor']);
    assert.equal(req.user.isGlobal, false);
  });

  it('valid token + current user missing → denied', async () => {
    setCurrentAuthContextLoaderForTests(async () => {
      throw new ApiError(401, 'Unauthorized', null, 'USER_NOT_FOUND');
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq(tokenFor()));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'USER_NOT_FOUND');
  });

  it('valid token + current user inactive → denied', async () => {
    setCurrentAuthContextLoaderForTests(async () => {
      throw new ApiError(403, 'Account is inactive or suspended', null, 'ACCOUNT_INACTIVE');
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq(tokenFor()));
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'ACCOUNT_INACTIVE');
  });

  it('token says super_admin/isGlobal but DB roles are normal → non-global', async () => {
    mockActive({ roles: ['student'], isGlobal: false, universityId: SYNTH_UNI_A });
    const req = bearerReq(
      tokenFor({ roles: ['super_admin'], isGlobal: true, universityId: null })
    );
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, false);
    assert.deepEqual(req.user.roles, ['student']);
  });

  it('token says normal role but DB has super_admin → current DB controls isGlobal', async () => {
    mockActive({ roles: ['super_admin'], isGlobal: true, universityId: null });
    const req = bearerReq(tokenFor({ roles: ['student'], isGlobal: false }));
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, true);
    assert.deepEqual(req.user.roles, ['super_admin']);
  });

  it('token has old universityId but DB has new university → DB university used', async () => {
    mockActive({ roles: ['university_admin'], universityId: SYNTH_UNI_B, isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['university_admin'], universityId: SYNTH_UNI_A }));
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.universityId, SYNTH_UNI_B);
  });

  it('token isGlobal=true but current roles do not resolve global → isGlobal false', async () => {
    mockActive({ roles: ['program_admin'], isGlobal: false, universityId: SYNTH_UNI_A });
    const req = bearerReq(tokenFor({ roles: ['program_admin'], isGlobal: true }));
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, false);
  });

  it('token isGlobal=false but current roles are super_admin → isGlobal true', async () => {
    mockActive({ roles: ['super_admin'], isGlobal: true, universityId: null });
    const req = bearerReq(tokenFor({ roles: ['super_admin'], isGlobal: false }));
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, true);
  });

  it('unknown current role does not silently grant allowlisted access', async () => {
    mockActive({ roles: ['employer_unknown'], isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['super_admin'], isGlobal: true }));
    await runMiddlewareAsync(authenticate, req);
    const out = runMiddlewareSync(authorizeRoles('super_admin'), req);
    assert.equal(out.status, 403);
  });

  it('missing current roles → empty roles, no isGlobal', async () => {
    mockActive({ roles: [], isGlobal: false, universityId: SYNTH_UNI_A });
    const req = bearerReq(tokenFor({ roles: ['instructor'] }));
    await runMiddlewareAsync(authenticate, req);
    assert.deepEqual(req.user.roles, []);
    assert.equal(req.user.isGlobal, false);
  });

  it('malformed token → denied before database loader', async () => {
    let loaderCalls = 0;
    setCurrentAuthContextLoaderForTests(async () => {
      loaderCalls += 1;
      return { userId: SYNTH_USER_A, roles: ['student'], universityId: null, isGlobal: false };
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq('not-a-jwt'));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'TOKEN_INVALID');
    assert.equal(loaderCalls, 0);
  });

  it('expired token → denied before database loader', async () => {
    let loaderCalls = 0;
    setCurrentAuthContextLoaderForTests(async () => {
      loaderCalls += 1;
      throw new Error('should not load');
    });
    const token = jwt.sign(
      { userId: SYNTH_USER_A, roles: ['student'], universityId: SYNTH_UNI_A, isGlobal: false },
      secret(),
      { expiresIn: -10 }
    );
    const out = await runMiddlewareAsync(authenticate, bearerReq(token));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'TOKEN_INVALID');
    assert.equal(loaderCalls, 0);
  });

  it('valid active user reaches authorizeRoles with current roles', async () => {
    mockActive({ roles: ['instructor'], isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['student'] }));
    await runMiddlewareAsync(authenticate, req);
    const out = runMiddlewareSync(authorizeRoles('instructor'), req);
    assert.equal(out.nextCalled, true);
  });

  it('removed role loses access on the next request', async () => {
    mockActive({ roles: ['student'], isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['instructor'] }));
    await runMiddlewareAsync(authenticate, req);
    const out = runMiddlewareSync(authorizeRoles('instructor'), req);
    assert.equal(out.status, 403);
  });

  it('newly assigned role follows allowlist on the next request', async () => {
    mockActive({ roles: ['academic_admin'], isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['student'] }));
    await runMiddlewareAsync(authenticate, req);
    const out = runMiddlewareSync(authorizeRoles('academic_admin'), req);
    assert.equal(out.nextCalled, true);
  });

  it('deactivated user cannot reach a protected handler (authorizeRoles not passed)', async () => {
    setCurrentAuthContextLoaderForTests(async () => {
      throw new ApiError(403, 'Account is inactive or suspended', null, 'ACCOUNT_INACTIVE');
    });
    const req = bearerReq(tokenFor());
    const out = await runMiddlewareAsync(authenticate, req);
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 403);
    assert.equal(req.user, undefined);
  });

  it('database loader error propagates as infrastructure failure (not auth success)', async () => {
    setCurrentAuthContextLoaderForTests(async () => {
      throw new Error('ECONNREFUSED simulated');
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq(tokenFor()));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, null);
    assert.ok(out.nextErr);
    assert.match(String(out.nextErr.message), /ECONNREFUSED/);
  });

  it('loader is called only once per request', async () => {
    let calls = 0;
    setCurrentAuthContextLoaderForTests(async (userId) => {
      calls += 1;
      return { userId, roles: ['student'], universityId: SYNTH_UNI_A, isGlobal: false };
    });
    await runMiddlewareAsync(authenticate, bearerReq(tokenFor()));
    assert.equal(calls, 1);
  });

  it('no privileged JWT claim overrides the current database record', async () => {
    mockActive({ roles: ['qa_officer'], universityId: SYNTH_UNI_B, isGlobal: false });
    const req = bearerReq(
      tokenFor({
        roles: ['super_admin', 'program_admin'],
        universityId: SYNTH_UNI_A,
        isGlobal: true,
      })
    );
    await runMiddlewareAsync(authenticate, req);
    assert.deepEqual(req.user.roles, ['qa_officer']);
    assert.equal(req.user.universityId, SYNTH_UNI_B);
    assert.equal(req.user.isGlobal, false);
  });

  it('public-style missing Authorization remains 401 without loader', async () => {
    let calls = 0;
    setCurrentAuthContextLoaderForTests(async () => {
      calls += 1;
      throw new Error('no');
    });
    const out = await runMiddlewareAsync(authenticate, createMockReq({ headers: {} }));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'UNAUTHORIZED');
    assert.equal(calls, 0);
  });

  it('IDENTITY-001 still uses current isGlobal from DB-backed req.user', async () => {
    mockActive({ roles: ['program_admin'], isGlobal: false });
    const req = bearerReq(tokenFor({ roles: ['super_admin'], isGlobal: true }));
    await runMiddlewareAsync(authenticate, req);
    assert.throws(
      () =>
        assertSuperAdminRoleMutationAllowed({
          requester: req.user,
          currentRoleCodes: [],
          requestedRoleCodes: ['super_admin'],
        }),
      (err) => err instanceof ApiError && err.code === FORBIDDEN_CODE
    );

    mockActive({ roles: ['super_admin'], isGlobal: true });
    const req2 = bearerReq(tokenFor({ roles: ['student'], isGlobal: false }));
    await runMiddlewareAsync(authenticate, req2);
    assert.doesNotThrow(() =>
      assertSuperAdminRoleMutationAllowed({
        requester: req2.user,
        currentRoleCodes: [],
        requestedRoleCodes: ['super_admin'],
      })
    );
  });

  it('loadCurrentAuthContext uses active injected loader', async () => {
    setCurrentAuthContextLoaderForTests(async () => ({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: null,
      isGlobal: false,
    }));
    const ctx = await loadCurrentAuthContext(SYNTH_USER_A);
    assert.equal(ctx.userId, SYNTH_USER_A);
  });
});
