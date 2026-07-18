/**
 * Phase 3 frontend: program_admin has no active runtime access; historical labels remain.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ROLE_SET,
  ASSIGNABLE_USER_ROLE_CODES,
  HISTORICAL_DISPLAY_ROLE_CODES,
  LEGACY_DEPRECATED_ROLE_CODES,
  ROLES,
  isLegacyDeprecatedRole,
} from '../src/constants/roles.js';
import { ADMIN_SHELL_ROLES, flattenAdminNavPaths } from '../src/constants/adminNavigation.js';
import { getDashboardPathForRole, isAdminRole } from '../src/utils/helpers.js';
import { roleLabelAr } from '../src/utils/labelsAr.js';
import { canManageUsers } from '../src/features/users/userPermissions.js';
import { FIELD_TRAINING_ADMIN_ROLES } from '../src/pages/admin/fieldTraining/fieldTrainingAdminAccess.js';
import { canAccessPathWithUiPermissions, canAccessPathWithUiPermissionsForUser } from '../src/utils/rolePermissions.js';

describe('program_admin Phase 3 frontend runtime removal', () => {
  it('active admin role sets exclude program_admin', () => {
    assert.equal(ADMIN_ROLE_SET.includes(ROLES.PROGRAM_ADMIN), false);
    assert.equal(ADMIN_SHELL_ROLES.includes(ROLES.PROGRAM_ADMIN), false);
    assert.equal(ASSIGNABLE_USER_ROLE_CODES.includes(ROLES.PROGRAM_ADMIN), false);
    assert.equal(FIELD_TRAINING_ADMIN_ROLES.includes(ROLES.PROGRAM_ADMIN), false);
    assert.ok(LEGACY_DEPRECATED_ROLE_CODES.includes(ROLES.PROGRAM_ADMIN));
    assert.equal(isLegacyDeprecatedRole(ROLES.PROGRAM_ADMIN), true);
  });

  it('admin navigation excludes program_admin', () => {
    assert.deepEqual(flattenAdminNavPaths(ROLES.PROGRAM_ADMIN), []);
  });

  it('route helpers deny program_admin (fail closed, not student)', () => {
    assert.equal(isAdminRole(ROLES.PROGRAM_ADMIN), false);
    assert.equal(getDashboardPathForRole(ROLES.PROGRAM_ADMIN), '/login');
    assert.equal(getDashboardPathForRole(ROLES.STUDENT), '/student');
    assert.equal(canAccessPathWithUiPermissions(ROLES.PROGRAM_ADMIN, '/admin/dashboard'), false);
    assert.equal(canAccessPathWithUiPermissions(ROLES.PROGRAM_ADMIN, '/student'), false);
    assert.equal(
      canAccessPathWithUiPermissionsForUser({ role: ROLES.PROGRAM_ADMIN }, '/admin/dashboard'),
      false
    );
  });

  it('user-management permissions deny program_admin', () => {
    assert.equal(canManageUsers({ roles: [ROLES.PROGRAM_ADMIN], isGlobal: false }), false);
    assert.equal(canManageUsers({ roles: [ROLES.SUPER_ADMIN], isGlobal: true }), true);
  });

  it('historical labels and filter codes remain available', () => {
    assert.equal(roleLabelAr('program_admin', 'en'), 'Program Admin — Deprecated');
    assert.equal(roleLabelAr('program_admin', 'ar'), 'إداري برامج — متوقف');
    assert.ok(HISTORICAL_DISPLAY_ROLE_CODES.includes(ROLES.PROGRAM_ADMIN));
  });
});
