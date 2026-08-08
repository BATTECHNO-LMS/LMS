'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CANONICAL_ROLE_CODES,
  INSTITUTION_SCOPED_ROLE_CODES,
  UNIVERSITY_SCOPED_ROLE_CODES,
  ROLE_META,
  pickPrimaryRoleCode,
} = require('../src/utils/roleCanon');
const { defaultRolePermissionMap } = require('../src/utils/permissionCatalog');
const { OFFICIAL_ROLES } = require('../src/modules/notificationEngine/notificationEngine.shared');
const { institutionRegisterSchema } = require('../src/modules/auth/auth.validation');

describe('trainee role catalog', () => {
  it('includes trainee once alongside student', () => {
    assert.ok(CANONICAL_ROLE_CODES.includes('trainee'));
    assert.ok(CANONICAL_ROLE_CODES.includes('student'));
    assert.equal(CANONICAL_ROLE_CODES.filter((c) => c === 'trainee').length, 1);
  });

  it('labels trainee as متدرب and student as طالب', () => {
    assert.equal(ROLE_META.trainee.name_ar, 'متدرب');
    assert.equal(ROLE_META.student.name_ar, 'طالب');
  });

  it('scopes trainee to institution and student to university', () => {
    assert.ok(INSTITUTION_SCOPED_ROLE_CODES.includes('trainee'));
    assert.ok(!INSTITUTION_SCOPED_ROLE_CODES.includes('student'));
    assert.ok(UNIVERSITY_SCOPED_ROLE_CODES.includes('student'));
    assert.ok(!UNIVERSITY_SCOPED_ROLE_CODES.includes('trainee'));
  });

  it('exposes trainee permissions without field_training', () => {
    const map = defaultRolePermissionMap();
    assert.ok(Array.isArray(map.trainee));
    assert.ok(map.trainee.includes('courses.view'));
    assert.ok(!map.trainee.some((c) => c.startsWith('field_training.')));
    assert.ok(map.student.some((c) => c.startsWith('field_training.')));
  });

  it('includes trainee in official notification roles', () => {
    assert.ok(OFFICIAL_ROLES.includes('trainee'));
  });

  it('picks trainee before student when both present', () => {
    assert.equal(pickPrimaryRoleCode(['student', 'trainee']), 'trainee');
  });
});

describe('trainee registration boundaries', () => {
  it('rejects role injection on public institution registration', () => {
    assert.throws(() =>
      institutionRegisterSchema.parse({
        full_name: 'x',
        phone: '0790000000',
        email: 'a@gmail.com',
        password: 'password123',
        organization_id: '11111111-1111-1111-1111-111111111111',
        branch_id: '22222222-2222-2222-2222-222222222222',
        role: 'admin',
      })
    );
  });
});
