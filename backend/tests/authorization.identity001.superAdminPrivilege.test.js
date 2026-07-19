'use strict';

/**
 * IDENTITY-001: super_admin privilege boundary (DB-free).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const { registerSchema } = require('../src/modules/auth/auth.validation');
const {
  FORBIDDEN_CODE,
  FORBIDDEN_MESSAGE,
  getCanonicalSuperAdminRoleCode,
  normalizeRoleCodes,
  includesSuperAdminRole,
  isTrustedGlobalRequester,
  assertSuperAdminRoleMutationAllowed,
  assertSuperAdminAdministrativeControlAllowed,
} = require('../src/modules/users/superAdminPrivilegeBoundary');
const { SYNTH_UNI_A } = require('./helpers/authzFixtures');

function expectForbidden(fn) {
  assert.throws(fn, (err) => {
    return (
      err instanceof ApiError &&
      err.statusCode === 403 &&
      err.code === FORBIDDEN_CODE &&
      err.message === FORBIDDEN_MESSAGE
    );
  });
}

describe('IDENTITY-001 superAdminPrivilegeBoundary', () => {
  it('canonical super_admin code resolves from env default', () => {
    assert.equal(getCanonicalSuperAdminRoleCode(), 'super_admin');
  });

  it('normalizeRoleCodes dedupes, lowercases, trims', () => {
    assert.deepEqual(normalizeRoleCodes([' Super_Admin ', 'student', 'super_admin']), [
      'super_admin',
      'student',
    ]);
  });

  it('includesSuperAdminRole detects case variants and duplicates', () => {
    assert.equal(includesSuperAdminRole(['SUPER_ADMIN', 'student']), true);
    assert.equal(includesSuperAdminRole(['super_admin', 'super_admin']), true);
    assert.equal(includesSuperAdminRole(['program_admin', 'instructor']), false);
  });

  it('isTrustedGlobalRequester depends only on isGlobal, not role name', () => {
    assert.equal(isTrustedGlobalRequester({ isGlobal: true, roles: [] }), true);
    assert.equal(isTrustedGlobalRequester({ isGlobal: false, roles: ['program_admin'] }), false);
    assert.equal(
      isTrustedGlobalRequester({ isGlobal: false, roles: ['super_admin'] }),
      false,
      'untrusted synthetic SA role without isGlobal must not pass the service gate'
    );
    assert.equal(isTrustedGlobalRequester({ isGlobal: true, roles: ['custom_ops'] }), true);
  });

  describe('create / role assignment', () => {
    it('non-global creating normal user roles → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['instructor', 'student'],
        })
      );
    });

    it('non-global creating super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['super_admin'],
        })
      );
    });

    it('non-global synthetic USER_WRITE-like role creating super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['custom_user_writer'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['student', 'super_admin'],
        })
      );
    });

    it('non-global mixed unknown + super_admin → 403 (not bypassable)', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['university_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['not_a_real_role', 'super_admin'],
        })
      );
    });

    it('global creating super_admin → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: true, roles: ['super_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['super_admin'],
        })
      );
    });
  });

  describe('update / promotion / demotion', () => {
    it('non-global adding super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: ['instructor'],
          requestedRoleCodes: ['instructor', 'super_admin'],
        })
      );
    });

    it('non-global self-promotion → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['instructor'], userId: 'self' },
          currentRoleCodes: ['instructor'],
          requestedRoleCodes: ['super_admin'],
        })
      );
    });

    it('non-global removing super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: ['super_admin', 'program_admin'],
          requestedRoleCodes: ['program_admin'],
        })
      );
    });

    it('non-global rewriting roles of existing super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: ['super_admin'],
          requestedRoleCodes: ['super_admin', 'instructor'],
        })
      );
    });

    it('global adding super_admin → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: true },
          currentRoleCodes: ['instructor'],
          requestedRoleCodes: ['super_admin'],
        })
      );
    });

    it('global removing super_admin → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: true },
          currentRoleCodes: ['super_admin'],
          requestedRoleCodes: ['university_admin'],
        })
      );
    });

    it('missing role_codes (undefined) skips role mutation check', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: ['instructor'],
          requestedRoleCodes: undefined,
        })
      );
    });

    it('duplicate super_admin values still blocked for non-global', () => {
      expectForbidden(() =>
        assertSuperAdminRoleMutationAllowed({
          requester: { isGlobal: false, roles: ['program_admin'] },
          currentRoleCodes: [],
          requestedRoleCodes: ['super_admin', 'Super_Admin', 'super_admin'],
        })
      );
    });
  });

  describe('administrative control of existing super_admin', () => {
    it('non-global controlling existing super_admin → 403', () => {
      expectForbidden(() =>
        assertSuperAdminAdministrativeControlAllowed(
          { isGlobal: false, roles: ['program_admin'] },
          ['super_admin']
        )
      );
    });

    it('non-global controlling normal user → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminAdministrativeControlAllowed(
          { isGlobal: false, roles: ['program_admin'] },
          ['instructor', 'student']
        )
      );
    });

    it('global controlling existing super_admin → allowed', () => {
      assert.doesNotThrow(() =>
        assertSuperAdminAdministrativeControlAllowed({ isGlobal: true }, ['super_admin'])
      );
    });

    it('does not depend on requester being named program_admin', () => {
      for (const role of [
        'program_admin',
        'university_admin',
        'academic_admin',
        'custom_ops_writer',
      ]) {
        expectForbidden(() =>
          assertSuperAdminAdministrativeControlAllowed(
            { isGlobal: false, roles: [role] },
            ['Super_Admin']
          )
        );
      }
    });
  });

  describe('public registration remains student-only (validator)', () => {
    it('registerSchema rejects role_codes / isGlobal', () => {
      assert.throws(() =>
        registerSchema.parse({
          full_name: 'Student',
          email: 's@example.com',
          password: 'secret1',
          university_id: SYNTH_UNI_A,
          university_specialty_id: SYNTH_UNI_A,
          role_codes: ['super_admin'],
        })
      );
    });
  });

  it('university_admin as non-global is still blocked from SA assignment (USER_WRITE orthogonal)', () => {
    // USER_WRITE may or may not include UA; boundary still applies whenever they reach the service.
    expectForbidden(() =>
      assertSuperAdminRoleMutationAllowed({
        requester: { isGlobal: false, roles: ['university_admin'] },
        currentRoleCodes: [],
        requestedRoleCodes: ['super_admin'],
      })
    );
  });
});
