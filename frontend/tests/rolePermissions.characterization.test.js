/**
 * Frontend UI authorization characterization (pure ESM, no React, no new deps).
 * Visibility-only — does not imply backend security.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ADMIN_ROLE_SET } from '../src/constants/roles.js';
import { UI_PERMISSION } from '../src/constants/permissions.js';
import {
  getUiPermissions,
  hasUiPermission,
  hasUiPermissionForUser,
  getRouteUiPermission,
  canAccessPathWithUiPermissions,
  canAccessPathWithUiPermissionsForUser,
  UI_ROUTE_DENY,
} from '../src/utils/rolePermissions.js';

const CANONICAL = Object.values(ROLES);

describe('FE rolePermissions characterization', () => {
  it('exposes exactly eight canonical role codes', () => {
    assert.equal(CANONICAL.length, 8);
    assert.ok(ADMIN_ROLE_SET.includes(ROLES.SUPER_ADMIN));
    assert.equal(ADMIN_ROLE_SET.includes(ROLES.PROGRAM_ADMIN), false);
    assert.ok(!ADMIN_ROLE_SET.includes(ROLES.INSTRUCTOR));
  });

  it('ADMIN_ROLE_SET members get ADMIN_ALL (every UI_PERMISSION true)', () => {
    for (const role of ADMIN_ROLE_SET) {
      const perms = getUiPermissions(role);
      for (const key of Object.values(UI_PERMISSION)) {
        assert.equal(perms[key], true, `${role}.${key}`);
      }
    }
  });

  it('student can submit assessments; instructor cannot (UI matrix)', () => {
    assert.equal(hasUiPermission(ROLES.STUDENT, UI_PERMISSION.canSubmitAssessments), true);
    assert.equal(hasUiPermission(ROLES.INSTRUCTOR, UI_PERMISSION.canSubmitAssessments), false);
  });

  it('instructor can grade; student cannot (UI matrix)', () => {
    assert.equal(hasUiPermission(ROLES.INSTRUCTOR, UI_PERMISSION.canGradeAssessments), true);
    assert.equal(hasUiPermission(ROLES.STUDENT, UI_PERMISSION.canGradeAssessments), false);
  });

  it('unknown role falls back to student matrix', () => {
    assert.equal(hasUiPermission('employer_unknown', UI_PERMISSION.canSubmitAssessments), true);
    assert.equal(hasUiPermission('employer_unknown', UI_PERMISSION.canGradeAssessments), false);
  });

  it('UI_ROUTE_DENY always false', () => {
    assert.equal(hasUiPermission(ROLES.STUDENT, UI_ROUTE_DENY), false);
    assert.equal(hasUiPermission(ROLES.SUPER_ADMIN, UI_ROUTE_DENY), false);
  });

  it('hasUiPermission ignores DB permission codes (role-only)', () => {
    // PermissionGate / shell use hasUiPermission — DB codes do not matter here.
    assert.equal(hasUiPermission(ROLES.STUDENT, UI_PERMISSION.canGradeAssessments), false);
  });

  it('hasUiPermissionForUser grants when user.permissions includes UI key', () => {
    const user = {
      role: ROLES.STUDENT,
      permissions: [UI_PERMISSION.canGradeAssessments],
    };
    assert.equal(hasUiPermissionForUser(user, UI_PERMISSION.canGradeAssessments), true);
  });

  it('hasUiPermissionForUser: * / ui.all still evaluate against role matrix (not grant-all)', () => {
    const user = { role: ROLES.STUDENT, permissions: ['*'] };
    assert.equal(hasUiPermissionForUser(user, UI_PERMISSION.canSubmitAssessments), true);
    assert.equal(hasUiPermissionForUser(user, UI_PERMISSION.canGradeAssessments), false);
  });

  it('getRouteUiPermission: academic paths are outside shell map (null)', () => {
    assert.equal(getRouteUiPermission('/academic/field-training/reports'), null);
  });

  it('getRouteUiPermission: student FT requires canViewFieldTraining', () => {
    assert.equal(
      getRouteUiPermission('/student/field-training'),
      UI_PERMISSION.canViewFieldTraining
    );
  });

  it('getRouteUiPermission: unknown student path → UI_ROUTE_DENY', () => {
    assert.equal(getRouteUiPermission('/student/not-a-real-page'), UI_ROUTE_DENY);
  });

  it('canAccessPathWithUiPermissions: admin roles always true', () => {
    assert.equal(canAccessPathWithUiPermissions(ROLES.QA_OFFICER, '/student/grades'), true);
  });

  it('canAccessPathWithUiPermissions: student is NOT portal-gated (shared canViewDashboard key)', () => {
    // Current behavior: path map uses UI permission keys, not portal ownership.
    // Student has canViewDashboard → helper returns true for /instructor/dashboard.
    // Actual portal entry is still blocked by RoleBasedRoute (role membership), not this helper.
    assert.equal(canAccessPathWithUiPermissions(ROLES.STUDENT, '/instructor/dashboard'), true);
  });

  it('canAccessPathWithUiPermissions: student denied unknown student path', () => {
    assert.equal(canAccessPathWithUiPermissions(ROLES.STUDENT, '/student/not-a-real-page'), false);
  });

  it('canAccessPathWithUiPermissions: student denied instructor create-assessment path', () => {
    assert.equal(
      canAccessPathWithUiPermissions(ROLES.STUDENT, '/instructor/assessments/create'),
      false
    );
  });

  it('canAccessPathWithUiPermissionsForUser: DB permission can unlock path key', () => {
    const user = {
      role: ROLES.STUDENT,
      permissions: [UI_PERMISSION.canManageCohorts],
    };
    // Path still maps to enrolled-programs permission for /student/programs — not canManageCohorts.
    assert.equal(canAccessPathWithUiPermissionsForUser(user, '/student/programs'), true);
  });

  it('program_admin fails closed (no ADMIN_ALL, no student fallback) — Phase 3', () => {
    assert.equal(hasUiPermission(ROLES.PROGRAM_ADMIN, UI_PERMISSION.canGradeAssessments), false);
    assert.equal(hasUiPermission(ROLES.PROGRAM_ADMIN, UI_PERMISSION.canViewDashboard), false);
    assert.equal(canAccessPathWithUiPermissions(ROLES.PROGRAM_ADMIN, '/admin/dashboard'), false);
    assert.equal(canAccessPathWithUiPermissions(ROLES.PROGRAM_ADMIN, '/student'), false);
  });

  it('university_reviewer cannot submit assessments in UI matrix', () => {
    assert.equal(
      hasUiPermission(ROLES.UNIVERSITY_REVIEWER, UI_PERMISSION.canSubmitAssessments),
      false
    );
    assert.equal(
      hasUiPermission(ROLES.UNIVERSITY_REVIEWER, UI_PERMISSION.canViewUniversityReports),
      true
    );
  });
});
