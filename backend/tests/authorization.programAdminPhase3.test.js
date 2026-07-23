'use strict';

/**
 * Legacy program_admin: no system-wide privilege; aliases to admin at AuthZ boundary.
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  isSystemWideAdmin,
  resolveUniversityIdFilter,
} = require('../src/utils/universityScope');
const {
  filterDeprecatedFromRoleAllowlist,
  isDeprecatedRuntimeRole,
  resetDeprecatedRoleWarningsForTests,
  PROGRAM_ADMIN_ROLE_CODE,
} = require('../src/utils/runtimeRoles');
const { parseRoleCodesWithFallback } = require('../src/config/env');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { env } = require('../src/config/env');
const {
  makeRequester,
  makeProgramAdmin,
  makeGlobalSuperAdmin,
  createMockReq,
  runMiddlewareSync,
  SYNTH_UNI_A,
  SYNTH_UNI_B,
} = require('./helpers/authzFixtures');

describe('program_admin legacy alias behavior', () => {
  afterEach(() => {
    resetDeprecatedRoleWarningsForTests();
  });

  it('isSystemWideAdmin returns false for program_admin', () => {
    assert.equal(isSystemWideAdmin(makeProgramAdmin()), false);
  });

  it('super_admin / isGlobal remains system-wide', () => {
    assert.equal(isSystemWideAdmin(makeGlobalSuperAdmin()), true);
    assert.equal(isSystemWideAdmin({ isGlobal: true, roles: [] }), true);
  });

  it('environment allowlists canonicalize program_admin to admin', () => {
    const filtered = parseRoleCodesWithFallback(
      'super_admin,program_admin,university_admin',
      'super_admin',
      'TEST_PHASE3_ENV_EXPLICIT'
    );
    assert.deepEqual(filtered, ['super_admin', 'admin']);
    assert.equal(filtered.includes(PROGRAM_ADMIN_ROLE_CODE), false);
  });

  it('environment filtering canonicalizes valid legacy active roles', () => {
    const filtered = filterDeprecatedFromRoleAllowlist(
      ['super_admin', 'university_admin', 'academic_admin', 'qa_officer'],
      'TEST_PHASE3_KEEP'
    );
    assert.deepEqual(filtered, ['super_admin', 'admin']);
  });

  it('safe warning is produced when program_admin appears in an allowlist', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      filterDeprecatedFromRoleAllowlist(['program_admin', 'super_admin'], 'TEST_PHASE3_WARN');
      filterDeprecatedFromRoleAllowlist(['program_admin'], 'TEST_PHASE3_WARN');
    } finally {
      console.warn = orig;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Canonicalized legacy role/);
  });

  it('isDeprecatedRuntimeRole recognizes legacy catalog codes', () => {
    assert.equal(isDeprecatedRuntimeRole('program_admin'), true);
    assert.equal(isDeprecatedRuntimeRole('admin'), false);
  });

  it('program_admin JWT cannot pass super_admin-only gate', () => {
    const mw = authorizeRoles('super_admin');
    assert.equal(
      runMiddlewareSync(mw, createMockReq({ user: makeProgramAdmin() })).status,
      403
    );
  });

  it('program_admin JWT can pass admin allowlist via alias', () => {
    const mw = authorizeRoles(...env.ADMIN_READ_ROLE_CODES);
    assert.equal(
      runMiddlewareSync(mw, createMockReq({ user: makeProgramAdmin() })).nextCalled,
      true
    );
  });

  it('resolveUniversityIdFilter still scopes program_admin-like requesters', () => {
    const pa = makeProgramAdmin({ universityId: SYNTH_UNI_A });
    assert.equal(resolveUniversityIdFilter(pa, null), SYNTH_UNI_A);
    assert.equal(resolveUniversityIdFilter(pa, SYNTH_UNI_A), SYNTH_UNI_A);
    assert.throws(
      () => resolveUniversityIdFilter(pa, SYNTH_UNI_B),
      (err) => err?.statusCode === 403
    );
  });
});
