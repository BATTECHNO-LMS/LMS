'use strict';

/**
 * Characterization: authenticate (JWT + current DB identity) + authorizeRoles.
 */

const { describe, it, afterEach } = require('node:test');
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
} = require('../src/modules/auth/currentAuthContext');
const {
  CANONICAL_ROLES,
  SYNTH_UNI_A,
  SYNTH_USER_A,
  makeRequester,
  createMockReq,
  runMiddlewareAsync,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

function bearerReq(token, extra = {}) {
  return createMockReq({
    headers: { authorization: token ? `Bearer ${token}` : undefined, ...extra.headers },
    ...extra,
  });
}

function secret() {
  return env.JWT_SECRET || 'battechno-dev-only-change-me';
}

function mirrorTokenClaimsAsDb(tokenPayload) {
  const roles = Array.isArray(tokenPayload.roles) ? tokenPayload.roles : [];
  const superCode = String(env.SUPER_ADMIN_ROLE_CODE || 'super_admin').toLowerCase();
  const isGlobal =
    Boolean(tokenPayload.isGlobal) ||
    roles.some((r) => String(r).toLowerCase() === superCode);
  setCurrentAuthContextLoaderForTests(async (userId) => ({
    userId,
    roles,
    universityId: tokenPayload.universityId ?? null,
    isGlobal,
  }));
}

describe('authenticate (JWT + current-state) characterization', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('denies missing Authorization header with 401 UNAUTHORIZED', async () => {
    const out = await runMiddlewareAsync(authenticate, createMockReq({ headers: {} }));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'UNAUTHORIZED');
  });

  it('denies non-Bearer scheme with 401 UNAUTHORIZED', async () => {
    const out = await runMiddlewareAsync(
      authenticate,
      createMockReq({ headers: { authorization: 'Basic abc' } })
    );
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'UNAUTHORIZED');
  });

  it('denies invalid token with 401 TOKEN_INVALID', async () => {
    const out = await runMiddlewareAsync(authenticate, bearerReq('not-a-jwt'));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'TOKEN_INVALID');
  });

  it('denies expired token with 401 TOKEN_INVALID', async () => {
    const token = jwt.sign(
      { userId: SYNTH_USER_A, roles: ['student'], universityId: SYNTH_UNI_A, isGlobal: false },
      secret(),
      { expiresIn: -10 }
    );
    const out = await runMiddlewareAsync(authenticate, bearerReq(token));
    assert.equal(out.status, 401);
    assert.equal(out.body.code, 'TOKEN_INVALID');
  });

  it('accepts valid synthetic token and populates req.user from current context', async () => {
    const payload = {
      userId: SYNTH_USER_A,
      roles: ['instructor'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
      portalType: 'UNIVERSITY',
    };
    mirrorTokenClaimsAsDb(payload);
    const token = signToken(payload);
    const req = bearerReq(token);
    const out = await runMiddlewareAsync(authenticate, req);
    assert.equal(out.nextCalled, true);
    assert.equal(out.status, null);
    assert.equal(req.user.userId, SYNTH_USER_A);
    assert.deepEqual(req.user.roles, ['instructor']);
    assert.equal(req.user.universityId, SYNTH_UNI_A);
    assert.equal(req.user.isGlobal, false);
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
      portalType: 'UNIVERSITY',
    });
    const req = bearerReq(token);
    await runMiddlewareAsync(authenticate, req);
    assert.equal(req.user.isGlobal, true);
  });

  it('rejects inactive users on protected authenticate (IDENTITY-003)', async () => {
    setCurrentAuthContextLoaderForTests(async () => {
      throw new ApiError(403, 'Account is inactive or suspended', null, 'ACCOUNT_INACTIVE');
    });
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
      portalType: 'UNIVERSITY',
    });
    const out = await runMiddlewareAsync(authenticate, bearerReq(token));
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'ACCOUNT_INACTIVE');
  });
});

describe('authorizeRoles characterization', () => {
  it('returns 401 when req.user is missing', () => {
    const mw = authorizeRoles('student');
    const out = runMiddlewareSync(mw, createMockReq({}));
    assert.equal(out.status, 401);
    assert.equal(out.body.message, 'يجب تسجيل الدخول للمتابعة.');
    assert.equal(out.body.code, 'UNAUTHORIZED');
  });

  it('allows when user has one of the allowed roles (case-insensitive)', () => {
    const mw = authorizeRoles('Student', 'Instructor');
    const req = createMockReq({ user: makeRequester({ roles: ['STUDENT'] }) });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.nextCalled, true);
  });

  it('denies with 403 when roles do not intersect', () => {
    const mw = authorizeRoles('super_admin');
    const req = createMockReq({ user: makeRequester({ roles: ['student'], isGlobal: false }) });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.status, 403);
    assert.equal(out.body.message, 'لا تملك صلاحية تنفيذ هذه العملية.');
    assert.equal(out.body.code, 'FORBIDDEN');
  });

  it('denies empty roles array with 403', () => {
    const mw = authorizeRoles('student');
    const req = createMockReq({ user: makeRequester({ roles: [], isGlobal: false }) });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.status, 403);
  });

  it('denies unknown role not in allowlist with 403', () => {
    const mw = authorizeRoles(...CANONICAL_ROLES);
    const req = createMockReq({
      user: makeRequester({ roles: ['employer_unknown'], isGlobal: false }),
    });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.status, 403);
  });

  it('isGlobal bypasses role allowlist entirely', () => {
    const mw = authorizeRoles('student');
    const req = createMockReq({
      user: makeRequester({ roles: [], isGlobal: true, universityId: null }),
    });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.nextCalled, true);
  });

  it('program_admin without isGlobal still requires role to be on allowlist', () => {
    const mw = authorizeRoles('super_admin');
    const req = createMockReq({
      user: makeRequester({ roles: ['program_admin'], isGlobal: false }),
    });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.status, 403);
  });

  it('legacy program_admin JWT is canonicalized to admin when admin is allowlisted', () => {
    const mw = authorizeRoles('program_admin', 'university_admin');
    const req = createMockReq({
      user: makeRequester({ roles: ['program_admin'], isGlobal: false }),
    });
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.nextCalled, true);
  });

  it('multiple allowed roles: any match succeeds (legacy aliases included)', () => {
    const mw = authorizeRoles('academic_admin', 'university_reviewer', 'qa_officer');
    for (const role of ['academic_admin', 'university_reviewer', 'qa_officer', 'admin', 'reviewer']) {
      const out = runMiddlewareSync(
        mw,
        createMockReq({ user: makeRequester({ roles: [role], isGlobal: false }) })
      );
      assert.equal(out.nextCalled, true, `expected allow for ${role}`);
    }
  });
});
