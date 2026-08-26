/**
 * Product-scope regression: navigation and removed-module access.
 * Avoids importing navigation.js (pulls i18n JSON ESM attributes).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../src/constants/roles.js';
import { flattenAdminNavPaths, getAdminNavGroupsForRole } from '../src/constants/adminNavigation.js';
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

  it('Super Admin and org admins see the Content Hub sidebar section', () => {
    const t = (key) => key;
    const expected = [
      '/admin/content-hub/help',
      '/admin/content-hub/tours',
      '/admin/content-hub/popups',
      '/admin/content-hub/announcements',
      '/admin/content-hub/notifications',
      '/admin/content-hub/notifications/send',
      '/admin/content-hub/notifications/deliveries',
      '/admin/content-hub/notifications/analytics',
      '/admin/content-hub/contextual',
      '/admin/content-hub/analytics',
      '/admin/content-hub/audit',
    ];
    for (const user of [uniAdmin, instAdmin, superAdmin]) {
      const groups = getAdminNavGroupsForRole(user.role, t, user);
      const content = groups.find((g) => g.id === 'contentHelp');
      assert.ok(content, `missing contentHelp group for ${user.role}`);
      const tos = content.items.map((item) => item.to);
      for (const path of expected) {
        assert.ok(tos.includes(path), `${user.role} missing ${path}`);
        assert.equal(canReach(user, path), true);
      }
    }
  });

  it('Reviewer, trainer, and learner roles do not receive Content Hub administration', () => {
    const t = (key) => key;
    assert.equal(getAdminNavGroupsForRole(ROLES.REVIEWER, t, { role: ROLES.REVIEWER }).length, 0);
    assert.equal(getAdminNavGroupsForRole(ROLES.TRAINER, t, { role: ROLES.TRAINER }).length, 0);
    assert.equal(getAdminNavGroupsForRole(ROLES.INSTRUCTOR, t, { role: ROLES.INSTRUCTOR }).length, 0);
    assert.equal(getAdminNavGroupsForRole(ROLES.STUDENT, t, { role: ROLES.STUDENT }).length, 0);
    assert.equal(getAdminNavGroupsForRole(ROLES.TRAINEE, t, { role: ROLES.TRAINEE }).length, 0);
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
