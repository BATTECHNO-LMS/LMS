'use strict';

/**
 * Compact regression: five canonical roles × representative sensitive allowlists.
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { env, parseRoleCodesWithFallback } = require('../src/config/env');
const {
  filterDeprecatedFromRoleAllowlist,
  resetDeprecatedRoleWarningsForTests,
} = require('../src/utils/runtimeRoles');
const {
  isSystemWideAdmin,
} = require('../src/utils/universityScope');
const {
  isFieldTrainingAdmin,
} = require('../src/modules/fieldTraining/fieldTraining.access');
const {
  makeRequester,
  makeGlobalSuperAdmin,
  makeProgramAdmin,
  createMockReq,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

const ACTIVE_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'instructor',
  'student',
  'academic_reviewer',
]);

/**
 * Representative sensitive lists from live env defaults.
 * Membership = role is on the allowlist (non-global requester).
 */
const REPRESENTATIVE = Object.freeze({
  USER_WRITE: env.USER_WRITE_ROLE_CODES,
  UNIVERSITY_WRITE: env.UNIVERSITY_WRITE_ROLE_CODES,
  ADMIN_READ: env.ADMIN_READ_ROLE_CODES,
  ACADEMIC_WRITE: env.ACADEMIC_WRITE_ROLE_CODES,
  CERTIFICATE_WRITE: env.CERTIFICATE_WRITE_ROLE_CODES,
  QA_OVERSIGHT: env.QA_OVERSIGHT_ROLE_CODES,
  REPORT_READ: env.REPORT_READ_ROLE_CODES,
  FIELD_TRAINING_ADMIN: env.FIELD_TRAINING_ADMIN_ROLE_CODES,
});

/** Expected allow (true) for canonical roles — matches five-role env defaults. */
const EXPECTED = Object.freeze({
  USER_WRITE: {
    super_admin: true,
    admin: false,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
  UNIVERSITY_WRITE: {
    super_admin: true,
    admin: false,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
  ADMIN_READ: {
    super_admin: true,
    admin: true,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
  ACADEMIC_WRITE: {
    super_admin: true,
    admin: true,
    instructor: true,
    student: false,
    academic_reviewer: false,
  },
  CERTIFICATE_WRITE: {
    super_admin: true,
    admin: true,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
  QA_OVERSIGHT: {
    super_admin: true,
    admin: true,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
  REPORT_READ: {
    super_admin: true,
    admin: true,
    instructor: false,
    student: false,
    academic_reviewer: true,
  },
  FIELD_TRAINING_ADMIN: {
    super_admin: true,
    admin: true,
    instructor: false,
    student: false,
    academic_reviewer: false,
  },
});

function assertRoleOnAllowlist(allowList, role, expectedAllowed) {
  const mw = authorizeRoles(...allowList);
  const out = runMiddlewareSync(
    mw,
    createMockReq({
      user: makeRequester({ roles: [role], isGlobal: false }),
    })
  );
  if (expectedAllowed) {
    assert.equal(out.nextCalled, true, `${role} should pass [${allowList}]`);
  } else {
    assert.equal(out.status, 403, `${role} should fail [${allowList}]`);
  }
}

describe('active-role authorization regression (five-role model)', () => {
  afterEach(() => {
    resetDeprecatedRoleWarningsForTests();
  });

  it('table-driven: five roles vs representative sensitive allowlists', () => {
    for (const [listName, allow] of Object.entries(REPRESENTATIVE)) {
      for (const legacy of [
        'program_admin',
        'university_admin',
        'academic_admin',
        'qa_officer',
        'university_reviewer',
      ]) {
        assert.equal(
          allow.includes(legacy),
          false,
          `${listName} must not list raw legacy code ${legacy}`
        );
      }
      const expected = EXPECTED[listName];
      assert.ok(expected, `missing EXPECTED for ${listName}`);
      for (const role of ACTIVE_ROLES) {
        assertRoleOnAllowlist(allow, role, expected[role]);
      }
      assertRoleOnAllowlist(allow, 'employer_unknown', false);
    }
  });

  it('USER_WRITE and UNIVERSITY_WRITE remain super_admin-only by default', () => {
    assert.deepEqual(env.USER_WRITE_ROLE_CODES, ['super_admin']);
    assert.deepEqual(env.UNIVERSITY_WRITE_ROLE_CODES, ['super_admin']);
    for (const role of ACTIVE_ROLES.filter((r) => r !== 'super_admin')) {
      assertRoleOnAllowlist(env.USER_WRITE_ROLE_CODES, role, false);
      assertRoleOnAllowlist(env.UNIVERSITY_WRITE_ROLE_CODES, role, false);
    }
  });

  it('super_admin with isGlobal retains intended bypass; unknown roles do not', () => {
    const sa = makeGlobalSuperAdmin();
    assert.equal(isSystemWideAdmin(sa), true);
    assert.equal(isFieldTrainingAdmin(sa), true);
    const settingsMw = authorizeRoles('super_admin');
    assert.equal(
      runMiddlewareSync(settingsMw, createMockReq({ user: sa })).nextCalled,
      true
    );

    const unknown = makeRequester({ roles: ['employer_unknown'], isGlobal: false });
    assert.equal(isSystemWideAdmin(unknown), false);
    assert.equal(isFieldTrainingAdmin(unknown), false);
    assert.equal(
      runMiddlewareSync(settingsMw, createMockReq({ user: unknown })).status,
      403
    );

    // Legacy JWT alias program_admin → admin (not super_admin)
    const pa = makeProgramAdmin();
    assert.equal(isSystemWideAdmin(pa), false);
    assert.equal(
      runMiddlewareSync(settingsMw, createMockReq({ user: pa })).status,
      403
    );
  });

  it('environment parsing canonicalizes legacy CSV codes', () => {
    const filtered = parseRoleCodesWithFallback(
      'super_admin,program_admin,university_admin,academic_admin,qa_officer,instructor,student,university_reviewer',
      'super_admin',
      'TEST_PHASE4_ACTIVE_ROLES_ENV'
    );
    assert.deepEqual(filtered, [
      'super_admin',
      'admin',
      'instructor',
      'student',
      'academic_reviewer',
    ]);
    assert.equal(filtered.includes('program_admin'), false);

    const kept = filterDeprecatedFromRoleAllowlist(ACTIVE_ROLES, 'TEST_PHASE4_KEEP_ACTIVE');
    assert.deepEqual(kept, [...ACTIVE_ROLES]);
  });

  it('characterization domains remain represented (FT, academic, QA, cert, report, scope)', () => {
    assert.ok(env.FIELD_TRAINING_ADMIN_ROLE_CODES.includes('admin'));
    assert.ok(env.ACADEMIC_WRITE_ROLE_CODES.includes('instructor'));
    assert.ok(env.QA_OVERSIGHT_ROLE_CODES.includes('admin'));
    assert.ok(env.CERTIFICATE_WRITE_ROLE_CODES.includes('admin'));
    assert.ok(env.REPORT_READ_ROLE_CODES.includes('academic_reviewer'));
    assert.equal(
      isSystemWideAdmin(makeRequester({ roles: ['admin'], isGlobal: false })),
      false
    );
    assert.equal(isSystemWideAdmin(makeGlobalSuperAdmin()), true);
  });
});
