'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toLoginUser, me } = require('../src/modules/auth/auth.service');
const { ALL_PERMISSION_CODES } = require('../src/utils/permissionCatalog');

function assignmentRow({
  id = '11111111-1111-4111-8111-111111111111',
  organizationId = '22222222-2222-4222-8222-222222222222',
  type = 'UNIVERSITY',
  name = 'Test University',
  roleCode = 'student',
} = {}) {
  return {
    id,
    organization_id: organizationId,
    role_code: roleCode,
    branch_id: null,
    department_id: null,
    job_title: null,
    employee_number: null,
    is_active: true,
    organizations: {
      id: organizationId,
      type,
      name,
      status: 'active',
      logo_url: null,
    },
    organization_branches: null,
    organization_departments: null,
  };
}

function profile({
  id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  full_name = 'Test User',
  roles = ['student'],
  orgType = 'UNIVERSITY',
} = {}) {
  return {
    id,
    full_name,
    email: `${roles[0]}@example.com`,
    phone: null,
    status: 'active',
    email_verified_at: new Date('2026-01-01'),
    primary_university_id: orgType === 'UNIVERSITY' ? '33333333-3333-4333-8333-333333333333' : null,
    preferred_organization_id: '22222222-2222-4222-8222-222222222222',
    university_specialty_id: null,
    specialty_id: null,
    specialties: null,
    university_specialty: null,
  };
}

function assertLoginShape(user) {
  assert.equal(typeof user.id, 'string');
  assert.equal(typeof user.full_name, 'string');
  assert.equal(typeof user.email, 'string');
  assert.ok(Array.isArray(user.roles));
  assert.ok(Array.isArray(user.permissions));
  assert.equal(typeof user.isGlobal, 'boolean');
  assert.ok(user.scope && typeof user.scope.type === 'string');
  assert.ok(Array.isArray(user.organizationAssignments));
  assert.ok('organizationType' in user);
  assert.ok('universityId' in user);
  assert.ok('role' in user);
  assert.ok('activeRole' in user);
}

const CASES = [
  {
    name: 'super_admin',
    roles: ['super_admin'],
    isGlobal: true,
    orgType: 'UNIVERSITY',
    roleCode: 'super_admin',
    permissions: [...ALL_PERMISSION_CODES],
  },
  {
    name: 'University Admin',
    roles: ['admin'],
    isGlobal: false,
    orgType: 'UNIVERSITY',
    roleCode: 'admin',
    permissions: ['users.read'],
  },
  {
    name: 'Institution Admin',
    roles: ['admin'],
    isGlobal: false,
    orgType: 'INSTITUTION',
    roleCode: 'admin',
    permissions: ['users.read'],
  },
  {
    name: 'reviewer',
    roles: ['reviewer'],
    isGlobal: false,
    orgType: 'UNIVERSITY',
    roleCode: 'reviewer',
    permissions: ['academic.read'],
  },
  {
    name: 'instructor',
    roles: ['instructor'],
    isGlobal: false,
    orgType: 'UNIVERSITY',
    roleCode: 'instructor',
    permissions: ['delivery.read'],
  },
  {
    name: 'student',
    roles: ['student'],
    isGlobal: false,
    orgType: 'UNIVERSITY',
    roleCode: 'student',
    permissions: ['student.read'],
  },
  {
    name: 'trainer',
    roles: ['trainer'],
    isGlobal: false,
    orgType: 'INSTITUTION',
    roleCode: 'trainer',
    permissions: ['training.read'],
  },
  {
    name: 'trainee',
    roles: ['trainee'],
    isGlobal: false,
    orgType: 'INSTITUTION',
    roleCode: 'trainee',
    permissions: ['training.read'],
  },
];

describe('/auth/me reuses authenticated context (no extra assignment/university queries)', () => {
  for (const c of CASES) {
    it(`${c.name}: toLoginUser reuses preloaded assignments and university`, async () => {
      const user = profile({ roles: c.roles, orgType: c.orgType, full_name: c.name });
      const rows = [
        assignmentRow({ type: c.orgType, roleCode: c.roleCode, name: `${c.name} Org` }),
      ];
      const university =
        c.orgType === 'UNIVERSITY'
          ? { id: user.primary_university_id, name: 'Uni' }
          : null;
      const out = await toLoginUser(user, c.roles.map((code) => ({ code })), c.permissions, c.isGlobal, {
        portalType: c.orgType,
        assignmentRows: rows,
        university,
        skipUniversityLink: true,
        skipUniversityQuery: true,
      });
      assertLoginShape(out);
      assert.deepEqual(out.roles, c.roles);
      assert.equal(out.isGlobal, c.isGlobal);
      assert.equal(out.organizationType, c.orgType);
      assert.equal(out.organizationAssignments.length, 1);
      if (c.isGlobal) {
        assert.equal(out.scope.type, 'global');
        assert.deepEqual(out.permissions, ALL_PERMISSION_CODES);
      }
    });

    it(`${c.name}: me() uses authContext profile + assignment rows`, async () => {
      const user = profile({ roles: c.roles, orgType: c.orgType, full_name: c.name });
      const rows = [assignmentRow({ type: c.orgType, roleCode: c.roleCode })];
      const university =
        c.orgType === 'UNIVERSITY' ? { id: user.primary_university_id, name: 'Uni' } : null;
      const out = await me(user.id, {
        portalType: c.orgType,
        authContext: {
          roles: c.roles,
          permissions: c.isGlobal ? [...ALL_PERMISSION_CODES] : c.permissions,
          isGlobal: c.isGlobal,
          portalType: c.orgType,
          university,
          _profile: user,
          _assignmentRows: rows,
        },
      });
      assertLoginShape(out);
      assert.equal(out.id, user.id);
      assert.deepEqual(out.roles, c.roles);
      assert.equal(out.organizationAssignments.length, 1);
    });
  }

  it('multi-organization user keeps all assignment rows and needsOrganizationSelection', async () => {
    const user = profile({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      full_name: 'Multi Org',
      roles: ['admin'],
      orgType: 'UNIVERSITY',
    });
    user.preferred_organization_id = null;
    const rows = [
      assignmentRow({
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
        type: 'UNIVERSITY',
        name: 'Uni A',
        roleCode: 'admin',
      }),
      assignmentRow({
        id: '11111111-1111-4111-8111-111111111112',
        organizationId: '22222222-2222-4222-8222-222222222223',
        type: 'UNIVERSITY',
        name: 'Uni B',
        roleCode: 'admin',
      }),
    ];
    const out = await toLoginUser(user, [{ code: 'admin' }], ['users.read'], false, {
      portalType: 'UNIVERSITY',
      assignmentRows: rows,
      university: { id: user.primary_university_id, name: 'Uni A' },
      skipUniversityLink: true,
      skipUniversityQuery: true,
    });
    assertLoginShape(out);
    assert.equal(out.organizationAssignments.length, 2);
    assert.equal(out.needsOrganizationSelection, true);
  });
});
