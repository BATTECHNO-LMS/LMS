'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CROWN_PRINCE_FOUNDATION,
  MINISTRY_OF_YOUTH,
  PUBLIC_INSTITUTION_SEEDS,
} = require('../src/modules/organizations/institutionSeedData');
const { institutionRegisterSchema } = require('../src/modules/auth/auth.validation');
const { evaluatePortalAccess } = require('../src/modules/auth/portalAccess');
const { AUTH_ERROR_CODES } = require('../src/utils/authErrorCatalog');

describe('institution seed data', () => {
  it('defines Crown Prince Foundation with 12 governorate branches', () => {
    assert.equal(CROWN_PRINCE_FOUNDATION.code, 'CROWN_PRINCE_FOUNDATION');
    assert.equal(CROWN_PRINCE_FOUNDATION.name, 'مؤسسة ولي العهد');
    assert.equal(CROWN_PRINCE_FOUNDATION.branches.length, 12);
    const codes = new Set(CROWN_PRINCE_FOUNDATION.branches.map((b) => b.code));
    assert.equal(codes.size, 12);
    assert.ok(codes.has('CPF_AMMAN'));
    assert.ok(codes.has('CPF_AQABA'));
  });

  it('defines Ministry of Youth with 13 directorate branches only', () => {
    assert.equal(MINISTRY_OF_YOUTH.code, 'MINISTRY_OF_YOUTH');
    assert.equal(MINISTRY_OF_YOUTH.name, 'وزارة الشباب');
    assert.equal(MINISTRY_OF_YOUTH.branches.length, 13);
    const codes = new Set(MINISTRY_OF_YOUTH.branches.map((b) => b.code));
    assert.equal(codes.size, 13);
    assert.ok(codes.has('MOY_CAPITAL'));
    assert.ok(codes.has('MOY_PETRA'));
    assert.ok([...codes].every((c) => c.startsWith('MOY_')));
  });

  it('exposes exactly two public institution seeds with unique codes', () => {
    assert.equal(PUBLIC_INSTITUTION_SEEDS.length, 2);
    const codes = PUBLIC_INSTITUTION_SEEDS.map((s) => s.code);
    assert.deepEqual(codes, ['CROWN_PRINCE_FOUNDATION', 'MINISTRY_OF_YOUTH']);
  });
});

describe('institution public registration schema', () => {
  const valid = {
    full_name: 'متدرب تجريبي',
    phone: '0790000000',
    email: 'trainee@gmail.com',
    password: 'password123',
    organization_id: '11111111-1111-1111-1111-111111111111',
    branch_id: '22222222-2222-2222-2222-222222222222',
  };

  it('accepts gmail / outlook / custom emails without university domain rules', () => {
    for (const email of ['a@gmail.com', 'b@outlook.com', 'c@org.example']) {
      const parsed = institutionRegisterSchema.parse({ ...valid, email });
      assert.equal(parsed.email, email);
    }
  });

  it('requires phone, institution, and branch', () => {
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, phone: '' }));
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, organization_id: undefined }));
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, branch_id: undefined }));
  });

  it('rejects employment fields and role injection via strict schema', () => {
    assert.throws(() =>
      institutionRegisterSchema.parse({ ...valid, employee_number: 'E1' })
    );
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, job_title: 'title' }));
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, department_id: valid.branch_id }));
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, role: 'admin' }));
    assert.throws(() => institutionRegisterSchema.parse({ ...valid, role_code: 'instructor' }));
  });
});

describe('portal access evaluation', () => {
  const uniOrg = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const instOrg = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('blocks university-only accounts from institution portal', () => {
    const result = evaluatePortalAccess(
      {
        assignments: [
          {
            organization_id: uniOrg,
            organizations: { type: 'UNIVERSITY', status: 'active' },
          },
        ],
        primaryUniversityId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        isGlobal: false,
      },
      'INSTITUTION'
    );
    assert.equal(result.allowed, false);
    assert.equal(result.details.loginPath, '/universities/login');
  });

  it('blocks institution-only accounts from university portal', () => {
    const result = evaluatePortalAccess(
      {
        assignments: [
          {
            organization_id: instOrg,
            organizations: { type: 'INSTITUTION', status: 'active' },
          },
        ],
        primaryUniversityId: null,
        isGlobal: false,
      },
      'UNIVERSITY'
    );
    assert.equal(result.allowed, false);
    assert.equal(result.details.loginPath, '/institutions/login');
  });

  it('allows dual-assignment users on either portal with filtered matches', () => {
    const assignments = [
      {
        organization_id: uniOrg,
        organizations: { type: 'UNIVERSITY', status: 'active' },
      },
      {
        organization_id: instOrg,
        organizations: { type: 'INSTITUTION', status: 'active' },
      },
    ];
    const inst = evaluatePortalAccess(
      { assignments, primaryUniversityId: null, isGlobal: false },
      'INSTITUTION'
    );
    const uni = evaluatePortalAccess(
      { assignments, primaryUniversityId: null, isGlobal: false },
      'UNIVERSITY'
    );
    assert.equal(inst.allowed, true);
    assert.deepEqual(inst.matchingOrganizationIds, [instOrg]);
    assert.equal(uni.allowed, true);
    assert.deepEqual(uni.matchingOrganizationIds, [uniOrg]);
  });

  it('allows super_admin without organization assignments', () => {
    const result = evaluatePortalAccess(
      { assignments: [], primaryUniversityId: null, isGlobal: true },
      'INSTITUTION'
    );
    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'super_admin');
  });

  it('exposes PORTAL_MISMATCH stable code', () => {
    assert.equal(AUTH_ERROR_CODES.PORTAL_MISMATCH, 'PORTAL_MISMATCH');
  });
});
