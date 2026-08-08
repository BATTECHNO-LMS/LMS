import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedLandingRoute } from '../src/utils/resolveAuthenticatedLandingRoute.js';
import { ROLES } from '../src/constants/roles.js';

describe('resolveAuthenticatedLandingRoute', () => {
  it('routes super_admin to global admin dashboard from either portal', () => {
    const user = {
      status: 'active',
      emailVerified: true,
      isGlobal: true,
      roles: [ROLES.SUPER_ADMIN],
      role: ROLES.SUPER_ADMIN,
    };
    const fromUni = resolveAuthenticatedLandingRoute(user, { selectedPortal: 'UNIVERSITY' });
    const fromInst = resolveAuthenticatedLandingRoute(user, { selectedPortal: 'INSTITUTION' });
    assert.equal(fromUni.path, '/admin/dashboard');
    assert.equal(fromInst.path, '/admin/dashboard');
    assert.equal(fromUni.portalMismatch, false);
  });

  it('routes university student to student dashboard', () => {
    const result = resolveAuthenticatedLandingRoute(
      {
        status: 'active',
        emailVerified: true,
        roles: [ROLES.STUDENT],
        role: ROLES.STUDENT,
        organizationType: 'UNIVERSITY',
        organizationId: 'org-1',
        universityId: 'uni-1',
      },
      { selectedPortal: 'UNIVERSITY' }
    );
    assert.equal(result.path, '/student/dashboard');
  });

  it('routes institution trainee to trainee dashboard', () => {
    const result = resolveAuthenticatedLandingRoute(
      {
        status: 'active',
        emailVerified: true,
        roles: [ROLES.TRAINEE],
        role: ROLES.TRAINEE,
        organizationType: 'INSTITUTION',
        organizationId: 'org-2',
      },
      { selectedPortal: 'INSTITUTION' }
    );
    assert.equal(result.path, '/trainee');
  });

  it('detects portal mismatch without treating it as auth failure', () => {
    const result = resolveAuthenticatedLandingRoute(
      {
        status: 'active',
        emailVerified: true,
        roles: [ROLES.TRAINEE],
        role: ROLES.TRAINEE,
        organizationType: 'INSTITUTION',
        organizationId: 'org-2',
      },
      { selectedPortal: 'UNIVERSITY' }
    );
    assert.equal(result.portalMismatch, true);
    assert.equal(result.path, '/trainee');
    assert.match(result.mismatchMessageAr, /المؤسسات/);
  });

  it('routes pending activation to account status', () => {
    const result = resolveAuthenticatedLandingRoute({
      status: 'inactive',
      emailVerified: true,
      roles: [ROLES.STUDENT],
      role: ROLES.STUDENT,
    });
    assert.equal(result.kind, 'account_status');
    assert.equal(result.path, '/account-status');
  });

  it('requires organization selection for multiple assignments', () => {
    const result = resolveAuthenticatedLandingRoute({
      status: 'active',
      emailVerified: true,
      roles: [ROLES.STUDENT],
      role: ROLES.STUDENT,
      needsOrganizationSelection: true,
      organizationAssignments: [
        { organizationId: 'a', organizationType: 'UNIVERSITY', isActive: true },
        { organizationId: 'b', organizationType: 'INSTITUTION', isActive: true },
      ],
    });
    assert.equal(result.kind, 'select_organization');
    assert.equal(result.path, '/select-organization');
  });

  it('routes institution admin to institution detail when organizationId present', () => {
    const result = resolveAuthenticatedLandingRoute({
      status: 'active',
      emailVerified: true,
      roles: [ROLES.ADMIN],
      role: ROLES.ADMIN,
      organizationType: 'INSTITUTION',
      organizationId: 'inst-9',
    });
    assert.equal(result.path, '/admin/institutions/inst-9');
  });
});
