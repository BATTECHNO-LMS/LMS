'use strict';

/**
 * Characterization: repository-default role allowlists (five canonical roles).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const { env } = require('../src/config/env');
const {
  makeRequester,
  createMockReq,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');
const { CANONICAL_ROLE_CODES } = require('../src/utils/roleCanon');

function assertRoleAllowed(allowList, role, expectedAllowed) {
  const mw = authorizeRoles(...allowList);
  const out = runMiddlewareSync(
    mw,
    createMockReq({ user: makeRequester({ roles: [role], isGlobal: false }) })
  );
  if (expectedAllowed) {
    assert.equal(out.nextCalled, true, `expected ${role} allowed`);
  } else {
    assert.equal(out.status, 403, `expected ${role} forbidden`);
  }
}

describe('env role defaults characterization (five-role model)', () => {
  it('live env defaults match five-role catalog', () => {
    assert.deepEqual(env.ADMIN_READ_ROLE_CODES, ['super_admin', 'admin']);
    assert.deepEqual(env.USER_WRITE_ROLE_CODES, ['super_admin']);
    assert.deepEqual(env.USER_ACTIVATE_ROLE_CODES, ['super_admin', 'admin']);
    assert.deepEqual(env.FIELD_TRAINING_ADMIN_ROLE_CODES, ['super_admin', 'admin']);
    assert.ok(env.REPORT_READ_ROLE_CODES.includes('reviewer'));
    assert.ok(env.ACADEMIC_WRITE_ROLE_CODES.includes('admin'));
    assert.ok(env.ACADEMIC_WRITE_ROLE_CODES.includes('instructor'));
  });

  it('no live env allowlist includes raw legacy codes', () => {
    const lists = [
      env.ADMIN_READ_ROLE_CODES,
      env.USER_WRITE_ROLE_CODES,
      env.USER_ACTIVATE_ROLE_CODES,
      env.CURRICULUM_WRITE_ROLE_CODES,
      env.ENROLLMENT_DECISION_ROLE_CODES,
      env.DELIVERY_WRITE_ROLE_CODES,
      env.ACADEMIC_WRITE_ROLE_CODES,
      env.CERTIFICATE_WRITE_ROLE_CODES,
      env.QA_OVERSIGHT_ROLE_CODES,
      env.REPORT_READ_ROLE_CODES,
      env.FIELD_TRAINING_ADMIN_ROLE_CODES,
    ];
    for (const list of lists) {
      for (const legacy of [
        'program_admin',
        'university_admin',
        'academic_admin',
        'qa_officer',
        'university_reviewer',
      ]) {
        assert.equal(list.includes(legacy), false, legacy);
      }
    }
  });

  it('USER_WRITE is super_admin-only', () => {
    assertRoleAllowed(env.USER_WRITE_ROLE_CODES, 'super_admin', true);
    assertRoleAllowed(env.USER_WRITE_ROLE_CODES, 'admin', false);
    assertRoleAllowed(env.USER_WRITE_ROLE_CODES, 'student', false);
  });

  it('ADMIN_READ allows admin', () => {
    assertRoleAllowed(env.ADMIN_READ_ROLE_CODES, 'admin', true);
  });

  it('canonical role set includes trainer and trainee', () => {
    assert.deepEqual([...CANONICAL_ROLE_CODES], [
      'super_admin',
      'admin',
      'instructor',
      'trainer',
      'trainee',
      'student',
      'reviewer',
    ]);
  });
});
