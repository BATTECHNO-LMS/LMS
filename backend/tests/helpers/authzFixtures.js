'use strict';

/**
 * Synthetic fixtures for authorization characterization tests.
 * No real credentials, emails, or production IDs.
 */

const CANONICAL_ROLES = Object.freeze([
  'super_admin',
  'program_admin',
  'university_admin',
  'academic_admin',
  'qa_officer',
  'instructor',
  'student',
  'university_reviewer',
]);

const SYNTH_UNI_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SYNTH_UNI_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SYNTH_USER_A = '11111111-1111-4111-8111-111111111111';
const SYNTH_USER_B = '22222222-2222-4222-8222-222222222222';
const SYNTH_OPP = '33333333-3333-4333-8333-333333333333';

/**
 * @param {Partial<{ userId: string, roles: string[], universityId: string|null, isGlobal: boolean }>} overrides
 */
function makeRequester(overrides = {}) {
  return {
    userId: overrides.userId ?? SYNTH_USER_A,
    roles: overrides.roles ?? ['student'],
    universityId: overrides.universityId === undefined ? SYNTH_UNI_A : overrides.universityId,
    isGlobal: Boolean(overrides.isGlobal),
  };
}

function makeGlobalSuperAdmin(overrides = {}) {
  return makeRequester({
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
    ...overrides,
  });
}

function makeProgramAdmin(overrides = {}) {
  return makeRequester({
    roles: ['program_admin'],
    isGlobal: false,
    universityId: SYNTH_UNI_A,
    ...overrides,
  });
}

/**
 * Minimal Express-like req/res for middleware characterization (no HTTP server).
 */
function createMockReq(overrides = {}) {
  return {
    headers: { ...(overrides.headers || {}) },
    user: overrides.user,
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

/**
 * Run Express-style middleware once (supports async middleware).
 * Returns { status, body, nextCalled, nextErr, req, res }.
 */
async function runMiddlewareAsync(middleware, req) {
  const res = createMockRes();
  let nextCalled = false;
  let nextErr = null;
  let settled = false;

  await new Promise((resolve) => {
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let result;
    try {
      result = middleware(req, res, (err) => {
        if (err) nextErr = err;
        else nextCalled = true;
        done();
      });
    } catch (err) {
      nextErr = err;
      done();
      return;
    }

    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (res.statusCode != null || nextCalled || nextErr) done();
        else setImmediate(done);
      }).catch((err) => {
        nextErr = err;
        done();
      });
    } else if (res.statusCode != null || nextCalled || nextErr) {
      done();
    } else {
      setImmediate(done);
    }
  });

  return {
    status: res.statusCode,
    body: res.body,
    nextCalled,
    nextErr,
    req,
    res,
  };
}

/**
 * Sync-friendly runner for purely synchronous middleware (e.g. authorizeRoles).
 * Do not use for authenticate (async DB revalidation).
 */
function runMiddlewareSync(middleware, req) {
  const res = createMockRes();
  let nextCalled = false;
  let nextErr = null;
  middleware(req, res, (err) => {
    if (err) nextErr = err;
    else nextCalled = true;
  });
  return {
    status: res.statusCode,
    body: res.body,
    nextCalled,
    nextErr,
    req,
    res,
  };
}

/** @deprecated Use runMiddlewareAsync for authenticate */
async function runMiddleware(middleware, req) {
  return runMiddlewareAsync(middleware, req);
}

module.exports = {
  CANONICAL_ROLES,
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  SYNTH_USER_B,
  SYNTH_OPP,
  makeRequester,
  makeGlobalSuperAdmin,
  makeProgramAdmin,
  createMockReq,
  createMockRes,
  runMiddleware,
  runMiddlewareAsync,
  runMiddlewareSync,
};
