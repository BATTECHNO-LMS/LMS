/**
 * Product-scope regression: navigation and removed-module access.
 * Avoids importing navigation.js (pulls i18n JSON ESM attributes).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../src/constants/roles.js';
import { flattenAdminNavPaths } from '../src/constants/adminNavigation.js';
import { canAccessPathWithUiPermissions } from '../src/utils/rolePermissions.js';

const uniAdmin = {
  role: ROLES.ADMIN,
  organizationType: 'UNIVERSITY',
  isGlobal: false,
};
const instAdmin = {
  role: ROLES.ADMIN,
  organizationType: 'INSTITUTION',
  isGlobal: false,
};
const superAdmin = {
  role: ROLES.SUPER_ADMIN,
  organizationType: null,
  isGlobal: true,
};

function canReach(user, pathname) {
  const paths = flattenAdminNavPaths(user.role, user);
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

describe('product scope navigation', () => {
  it('University Admin sees Courses, Micro-Credentials, and Field Training', () => {
    const paths = flattenAdminNavPaths(ROLES.ADMIN, uniAdmin);
    assert.ok(paths.includes('/admin/training-courses'));
    assert.ok(paths.includes('/admin/micro-credentials'));
    assert.ok(paths.includes('/admin/field-training'));
    assert.equal(canReach(uniAdmin, '/admin/training-courses'), true);
    assert.equal(canReach(uniAdmin, '/admin/micro-credentials'), true);
    assert.equal(canReach(uniAdmin, '/admin/field-training'), true);
  });

  it('Institution Admin sees Courses and Micro-Credentials and is denied Field Training', () => {
    const paths = flattenAdminNavPaths(ROLES.ADMIN, instAdmin);
    assert.ok(paths.includes('/admin/training-courses'));
    assert.ok(paths.includes('/admin/micro-credentials'));
    assert.equal(paths.includes('/admin/field-training'), false);
    assert.equal(canReach(instAdmin, '/admin/training-courses'), true);
    assert.equal(canReach(instAdmin, '/admin/micro-credentials'), true);
    assert.equal(canReach(instAdmin, '/admin/field-training'), false);
  });

  it('Super Admin sees all three product domains', () => {
    const paths = flattenAdminNavPaths(ROLES.SUPER_ADMIN, superAdmin);
    assert.ok(paths.includes('/admin/training-courses'));
    assert.ok(paths.includes('/admin/micro-credentials'));
    assert.ok(paths.includes('/admin/field-training'));
  });

  it('Student sees Courses, Micro-Credentials, and Field Training', () => {
    assert.equal(canAccessPathWithUiPermissions(ROLES.STUDENT, '/student/courses'), true);
    assert.equal(canAccessPathWithUiPermissions(ROLES.STUDENT, '/student/available-cohorts'), true);
    assert.equal(canAccessPathWithUiPermissions(ROLES.STUDENT, '/student/field-training'), true);
  });

  it('Trainee sees Courses and no Field Training', () => {
    assert.equal(canAccessPathWithUiPermissions(ROLES.TRAINEE, '/trainee/courses'), true);
    assert.equal(canAccessPathWithUiPermissions(ROLES.TRAINEE, '/student/field-training'), false);
  });

  it('removed QA / Risk / Recognition admin paths are not reachable', () => {
    for (const user of [uniAdmin, instAdmin, superAdmin]) {
      const paths = flattenAdminNavPaths(user.role, user);
      assert.equal(paths.some((p) => /qa|risk|recognition|integrity|evidence/.test(p)), false);
      assert.equal(canReach(user, '/admin/qa'), false);
      assert.equal(canReach(user, '/admin/risk-cases'), false);
      assert.equal(canReach(user, '/admin/recognition-requests'), false);
    }
    assert.equal(canAccessPathWithUiPermissions(ROLES.INSTRUCTOR, '/instructor/evidence'), false);
    assert.equal(canAccessPathWithUiPermissions(ROLES.INSTRUCTOR, '/instructor/risk-students'), false);
    assert.equal(canAccessPathWithUiPermissions(ROLES.REVIEWER, '/reviewer/recognition-requests'), false);
  });
});
