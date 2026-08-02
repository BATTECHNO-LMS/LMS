'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CANONICAL_ROLE_CODES,
  INSTITUTION_SCOPED_ROLE_CODES,
  ROLE_META,
  pickPrimaryRoleCode,
} = require('../src/utils/roleCanon');
const { defaultRolePermissionMap } = require('../src/utils/permissionCatalog');
const { OFFICIAL_ROLES } = require('../src/modules/notificationEngine/notificationEngine.shared');
const { institutionRegisterSchema } = require('../src/modules/auth/auth.validation');
const { evaluatePortalAccess } = require('../src/modules/auth/portalAccess');
const { TRAINER_PERMISSION_KEYS } = require('../src/modules/trainingPrograms/trainerScope');

describe('trainer role catalog', () => {
  it('includes trainer once in canonical roles', () => {
    assert.ok(CANONICAL_ROLE_CODES.includes('trainer'));
    assert.equal(CANONICAL_ROLE_CODES.filter((c) => c === 'trainer').length, 1);
    assert.ok(CANONICAL_ROLE_CODES.includes('instructor'));
  });

  it('keeps instructor and trainer as separate codes', () => {
    assert.notEqual(ROLE_META.instructor.name_ar, ROLE_META.trainer.name_ar);
    assert.equal(ROLE_META.trainer.name_ar, 'المدرب');
  });

  it('lists trainer as institution-scoped role and not university-only instructor', () => {
    assert.ok(INSTITUTION_SCOPED_ROLE_CODES.includes('trainer'));
    assert.ok(!INSTITUTION_SCOPED_ROLE_CODES.includes('instructor'));
  });

  it('exposes trainer permission matrix without field_training', () => {
    const map = defaultRolePermissionMap();
    assert.ok(Array.isArray(map.trainer));
    assert.ok(map.trainer.includes('courses.view'));
    assert.ok(!map.trainer.some((c) => c.startsWith('field_training.')));
    assert.ok(map.instructor.some((c) => c.startsWith('field_training.')));
  });

  it('includes trainer in notification official roles', () => {
    assert.ok(OFFICIAL_ROLES.includes('trainer'));
  });

  it('includes trainer in content CMS official roles', () => {
    const { OFFICIAL_ROLES: cmsRoles } = require('../src/modules/contentCms/contentCms.shared');
    assert.ok(cmsRoles.includes('trainer'));
    assert.ok(cmsRoles.includes('instructor'));
  });

  it('defines course-level trainer permission keys', () => {
    assert.ok(TRAINER_PERMISSION_KEYS.includes('can_manage_sessions'));
    assert.ok(TRAINER_PERMISSION_KEYS.includes('can_view_reports'));
  });

  it('merges assignment permission flags with OR', () => {
    const {
      mergeAssignmentPermissionFlags,
      resolveAccessibleCohortIds,
    } = require('../src/modules/trainingPrograms/trainerScope');
    const merged = mergeAssignmentPermissionFlags([
      { can_manage_sessions: true, can_view_trainees: false, is_lead_trainer: false },
      { can_manage_sessions: false, can_view_trainees: true, is_lead_trainer: true },
    ]);
    assert.equal(merged.permissions.can_manage_sessions, true);
    assert.equal(merged.permissions.can_view_trainees, true);
    assert.equal(merged.isLeadTrainer, true);
    assert.equal(resolveAccessibleCohortIds([{ training_cohort_id: null }]), null);
    assert.deepEqual(resolveAccessibleCohortIds([{ training_cohort_id: 'c1' }, { training_cohort_id: 'c2' }]), [
      'c1',
      'c2',
    ]);
  });
});

describe('trainer portal and registration boundaries', () => {
  it('rejects trainer injection on public institution registration', () => {
    assert.throws(() =>
      institutionRegisterSchema.parse({
        full_name: 'x',
        phone: '0790000000',
        email: 'a@gmail.com',
        password: 'password123',
        organization_id: '11111111-1111-1111-1111-111111111111',
        branch_id: '22222222-2222-2222-2222-222222222222',
        role: 'trainer',
      })
    );
  });

  it('blocks trainer-only institution account on university portal', () => {
    const result = evaluatePortalAccess(
      {
        assignments: [
          {
            organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
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

  it('allows institution portal for trainer assignment org type', () => {
    const result = evaluatePortalAccess(
      {
        assignments: [
          {
            organization_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            organizations: { type: 'INSTITUTION', status: 'active' },
          },
        ],
        primaryUniversityId: null,
        isGlobal: false,
      },
      'INSTITUTION'
    );
    assert.equal(result.allowed, true);
  });

  it('prefers instructor over trainer when both present for primary pick', () => {
    assert.equal(pickPrimaryRoleCode(['trainer', 'instructor']), 'instructor');
  });
});
