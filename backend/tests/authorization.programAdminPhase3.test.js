'use strict';

/**
 * Phase 3: program_admin grants no runtime authorization.
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

describe('program_admin Phase 3 runtime removal', () => {
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

  it('environment allowlists ignore program_admin even when explicitly configured', () => {
    const filtered = parseRoleCodesWithFallback(
      'super_admin,program_admin,university_admin',
      'super_admin',
      'TEST_PHASE3_ENV_EXPLICIT'
    );
    assert.deepEqual(filtered, ['super_admin', 'university_admin']);
    assert.equal(filtered.includes(PROGRAM_ADMIN_ROLE_CODE), false);
  });

  it('environment filtering does not remove valid active roles', () => {
    const filtered = filterDeprecatedFromRoleAllowlist(
      ['super_admin', 'university_admin', 'academic_admin', 'qa_officer'],
      'TEST_PHASE3_KEEP'
    );
    assert.deepEqual(filtered, [
      'super_admin',
      'university_admin',
      'academic_admin',
      'qa_officer',
    ]);
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
    assert.match(warnings[0], /Ignoring deprecated runtime role/);
    assert.match(warnings[0], /TEST_PHASE3_WARN/);
    assert.equal(warnings[0].includes('DATABASE_URL'), false);
  });

  it('program_admin cannot pass representative Backend admin allowlists', () => {
    const lists = [
      env.USER_WRITE_ROLE_CODES,
      env.UNIVERSITY_WRITE_ROLE_CODES,
      env.ADMIN_READ_ROLE_CODES,
      env.CERTIFICATE_WRITE_ROLE_CODES,
      env.RECOGNITION_WRITE_ROLE_CODES,
      env.QA_OVERSIGHT_ROLE_CODES,
      env.REPORT_READ_ROLE_CODES,
      env.FIELD_TRAINING_ADMIN_ROLE_CODES,
      env.FIELD_TRAINING_MANAGE_ROLE_CODES,
    ];
    for (const allow of lists) {
      assert.equal(allow.includes('program_admin'), false, `allowlist leaked PA: ${allow}`);
      const out = runMiddlewareSync(
        authorizeRoles(...allow),
        createMockReq({ user: makeProgramAdmin() })
      );
      assert.equal(out.status, 403, `PA should be forbidden for ${allow.join(',')}`);
    }
  });

  it('USER_WRITE and UNIVERSITY_WRITE are super_admin-only by default', () => {
    assert.deepEqual(env.USER_WRITE_ROLE_CODES, ['super_admin']);
    assert.deepEqual(env.UNIVERSITY_WRITE_ROLE_CODES, ['super_admin']);
  });

  it('program_admin is not system-wide for university scope', () => {
    assert.throws(() => resolveUniversityIdFilter(makeProgramAdmin({ universityId: SYNTH_UNI_A }), SYNTH_UNI_B));
  });

  it('isDeprecatedRuntimeRole recognizes program_admin', () => {
    assert.equal(isDeprecatedRuntimeRole('program_admin'), true);
    assert.equal(isDeprecatedRuntimeRole('Program_Admin'), true);
    assert.equal(isDeprecatedRuntimeRole('university_admin'), false);
  });

  it('university_admin retains non-global scoped behavior (not widened)', () => {
    assert.equal(
      isSystemWideAdmin(makeRequester({ roles: ['university_admin'], isGlobal: false })),
      false
    );
    const out = runMiddlewareSync(
      authorizeRoles(...env.ADMIN_READ_ROLE_CODES),
      createMockReq({
        user: makeRequester({ roles: ['university_admin'], isGlobal: false, universityId: SYNTH_UNI_A }),
      })
    );
    assert.equal(out.nextCalled, true);
  });

  it('authorizeRoles strips program_admin from hardcoded allowlists', () => {
    const mw = authorizeRoles('program_admin');
    const out = runMiddlewareSync(mw, createMockReq({ user: makeProgramAdmin() }));
    assert.equal(out.status, 403);
  });

  it('settings / audit defaults deny program_admin; SA still allowed via isGlobal', () => {
    const settingsMw = authorizeRoles('super_admin');
    assert.equal(
      runMiddlewareSync(settingsMw, createMockReq({ user: makeProgramAdmin() })).status,
      403
    );
    assert.equal(
      runMiddlewareSync(settingsMw, createMockReq({ user: makeGlobalSuperAdmin() })).nextCalled,
      true
    );
  });
});
