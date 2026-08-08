'use strict';

/**
 * Characterization: canonical five-role model + legacy aliases.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalizeRoleCode,
  normalizeRoleCodes,
  pickPrimaryRoleCode,
  LEGACY_ROLE_ALIASES,
  CANONICAL_ROLE_CODES,
} = require('../src/utils/roleCanon');
const { filterDeprecatedFromRoleAllowlist } = require('../src/utils/runtimeRoles');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');

describe('roleCanon', () => {
  it('maps legacy roles to canonical codes', () => {
    assert.equal(canonicalizeRoleCode('university_admin'), 'admin');
    assert.equal(canonicalizeRoleCode('academic_admin'), 'admin');
    assert.equal(canonicalizeRoleCode('qa_officer'), 'admin');
    assert.equal(canonicalizeRoleCode('program_admin'), 'admin');
    assert.equal(canonicalizeRoleCode('university_reviewer'), 'reviewer');
    assert.equal(canonicalizeRoleCode('academic_reviewer'), 'reviewer');
    assert.equal(canonicalizeRoleCode('reviewer'), 'reviewer');
    assert.equal(canonicalizeRoleCode('super_admin'), 'super_admin');
  });

  it('never aliases anything to super_admin', () => {
    for (const [legacy, target] of Object.entries(LEGACY_ROLE_ALIASES)) {
      assert.notEqual(target, 'super_admin', legacy);
    }
  });

  it('dedupes after aliasing', () => {
    assert.deepEqual(
      normalizeRoleCodes(['university_admin', 'academic_admin', 'qa_officer']),
      ['admin']
    );
  });

  it('picks primary role with admin priority', () => {
    assert.equal(pickPrimaryRoleCode(['student', 'admin']), 'admin');
    assert.equal(pickPrimaryRoleCode(['university_reviewer']), 'reviewer');
  });

  it('canonical set includes trainer and trainee alongside instructor/student', () => {
    assert.deepEqual(CANONICAL_ROLE_CODES, [
      'super_admin',
      'admin',
      'instructor',
      'trainer',
      'trainee',
      'student',
      'reviewer',
    ]);
  });

  it('picks trainer when present without instructor', () => {
    assert.equal(pickPrimaryRoleCode(['student', 'trainer']), 'trainer');
  });
});

describe('authorizeRoles with legacy allowlists', () => {
  it('allows admin user when route still lists university_admin', () => {
    const mw = authorizeRoles('university_admin', 'academic_admin');
    let nextCalled = false;
    mw(
      { user: { roles: ['admin'], isGlobal: false } },
      { status: () => ({ json: () => {} }) },
      () => {
        nextCalled = true;
      }
    );
    assert.equal(nextCalled, true);
  });

  it('allows reviewer when route lists university_reviewer', () => {
    const mw = authorizeRoles('university_reviewer');
    let nextCalled = false;
    mw(
      { user: { roles: ['reviewer'], isGlobal: false } },
      { status: () => ({ json: () => {} }) },
      () => {
        nextCalled = true;
      }
    );
    assert.equal(nextCalled, true);
  });

  it('canonicalizes env-style allowlists', () => {
    const list = filterDeprecatedFromRoleAllowlist(
      ['super_admin', 'university_admin', 'university_reviewer'],
      'test_allowlist'
    );
    assert.deepEqual(list, ['super_admin', 'admin', 'reviewer']);
  });
});
