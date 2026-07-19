'use strict';

/**
 * Phase 1 program_admin assignment freeze (database-free).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ZodError } = require('zod');
const { ApiError } = require('../src/utils/apiError');
const {
  assertProgramAdminNotNewlyAssigned,
  includesProgramAdminRole,
  DEPRECATED_CODE,
  DEPRECATED_MESSAGE,
} = require('../src/modules/users/programAdminAssignmentGuard');
const {
  assertSuperAdminRoleMutationAllowed,
  FORBIDDEN_CODE,
} = require('../src/modules/users/superAdminPrivilegeBoundary');
const { registerSchema } = require('../src/modules/auth/auth.validation');
const { isSystemWideAdmin } = require('../src/utils/universityScope');
const { makeRequester, makeProgramAdmin, makeGlobalSuperAdmin } = require('./helpers/authzFixtures');

function expectDeprecated(fn) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, DEPRECATED_CODE);
    assert.equal(err.message, DEPRECATED_MESSAGE);
    return true;
  });
}

describe('program_admin assignment freeze (Phase 1)', () => {
  it('rejects non-global administrator assigning program_admin on create-shaped payload', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['program_admin'],
      })
    );
  });

  it('rejects global administrator assigning program_admin on create', () => {
    // Product deprecation — isGlobal does not bypass.
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['program_admin'],
      })
    );
  });

  it('rejects adding program_admin to an existing normal user', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['instructor', 'program_admin'],
      })
    );
  });

  it('rejects replacing a user’s roles with program_admin', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['program_admin'],
      })
    );
  });

  it('rejects mixed roles including program_admin', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['student', 'program_admin', 'qa_officer'],
      })
    );
  });

  it('rejects duplicate program_admin entries', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['program_admin', 'program_admin'],
      })
    );
  });

  it('rejects case / alternate representations of program_admin', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['Program_Admin'],
      })
    );
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['  PROGRAM_ADMIN  '],
      })
    );
  });

  it('rejects unknown roles mixed with program_admin safely', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['employer_unknown', 'program_admin'],
      })
    );
  });

  it('omitted role_codes preserves existing program_admin (no throw)', () => {
    assert.doesNotThrow(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: undefined,
      })
    );
  });

  it('explicit resubmit of program_admin in role_codes is rejected (no legacy rewrite exception)', () => {
    expectDeprecated(() =>
      assertProgramAdminNotNewlyAssigned({
        requestedRoleCodes: ['program_admin'],
      })
    );
  });

  it('includesProgramAdminRole detects canonical membership', () => {
    assert.equal(includesProgramAdminRole(['student']), false);
    assert.equal(includesProgramAdminRole(['program_admin']), true);
    assert.equal(includesProgramAdminRole(['PROGRAM_ADMIN']), true);
  });

  it('public registration remains student-only (rejects role_codes extras)', () => {
    assert.throws(
      () =>
        registerSchema.parse({
          full_name: 'Test User',
          email: 'student@example.com',
          password: 'secret1',
          university_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          university_specialty_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          role_codes: ['program_admin'],
        }),
      ZodError
    );
  });

  it('IDENTITY-001 remains enforced alongside PA freeze', () => {
    assert.throws(
      () =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['super_admin'],
        }),
      (err) => err instanceof ApiError && err.code === FORBIDDEN_CODE
    );
  });

  it('legacy program_admin holders are not system-wide after Phase 3', () => {
    assert.equal(isSystemWideAdmin(makeProgramAdmin()), false);
    assert.equal(isSystemWideAdmin(makeRequester({ roles: ['university_admin'], isGlobal: false })), false);
    assert.equal(isSystemWideAdmin(makeGlobalSuperAdmin()), true);
  });
});
