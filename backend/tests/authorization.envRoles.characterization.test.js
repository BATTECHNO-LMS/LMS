'use strict';

/**
 * Characterization: repository-default role allowlists for sensitive operations (Phase 3).
 * program_admin removed from all active defaults.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const {
  CANONICAL_ROLES,
  makeRequester,
  createMockReq,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

/** Defaults mirrored from backend/src/config/env.js after Phase 3 PA removal. */
const DEFAULTS = {
  ADMIN_READ: ['super_admin', 'university_admin'],
  USER_WRITE: ['super_admin'],
  USER_ACTIVATE: ['super_admin', 'university_admin', 'academic_admin'],
  CURRICULUM_WRITE: ['super_admin', 'academic_admin'],
  ENROLLMENT_DECISION: ['super_admin', 'academic_admin', 'university_reviewer'],
  DELIVERY_WRITE: ['super_admin', 'university_admin', 'academic_admin', 'instructor'],
  ACADEMIC_WRITE: ['super_admin', 'university_admin', 'academic_admin', 'instructor'],
  CERTIFICATE_WRITE: ['super_admin', 'university_admin', 'academic_admin'],
  QA_OVERSIGHT: ['super_admin', 'university_admin', 'academic_admin', 'qa_officer'],
  RISK_INTEGRITY: [
    'super_admin',
    'university_admin',
    'academic_admin',
    'qa_officer',
    'instructor',
  ],
  REPORT_READ: [
    'super_admin',
    'university_admin',
    'academic_admin',
    'qa_officer',
    'university_reviewer',
  ],
  FIELD_TRAINING_ADMIN: ['super_admin', 'university_admin', 'academic_admin'],
  FIELD_TRAINING_INSTRUCTOR: ['instructor'],
  SETTINGS: ['super_admin'],
  STUDENT_ONLY: ['student'],
};

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

describe('env role defaults characterization (Phase 3)', () => {
  it('no default allowlist includes program_admin', () => {
    for (const [name, list] of Object.entries(DEFAULTS)) {
      assert.equal(list.includes('program_admin'), false, name);
    }
  });

  it('program_admin is denied on every sensitive default allowlist', () => {
    for (const list of Object.values(DEFAULTS)) {
      assertRoleAllowed(list, 'program_admin', false);
    }
  });

  it('USER_WRITE is super_admin-only (was SA+PA)', () => {
    assertRoleAllowed(DEFAULTS.USER_WRITE, 'super_admin', true);
    assertRoleAllowed(DEFAULTS.USER_WRITE, 'university_admin', false);
    assertRoleAllowed(DEFAULTS.USER_WRITE, 'program_admin', false);
  });

  it('UNIVERSITY-equivalent: ADMIN_READ still allows university_admin', () => {
    assertRoleAllowed(DEFAULTS.ADMIN_READ, 'university_admin', true);
  });

  it('canonical roles still list program_admin historically', () => {
    assert.ok(CANONICAL_ROLES.includes('program_admin'));
  });
});
