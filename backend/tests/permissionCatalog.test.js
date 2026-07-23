'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MODULES,
  ACTIONS,
  ALL_PERMISSION_CODES,
  isWritePermissionCode,
  reviewerAllowedCodes,
  defaultRolePermissionMap,
} = require('../src/utils/permissionCatalog');
const { requirePermission, enforceAcademicReviewerReadOnly } = require('../src/middlewares/permission.middleware');
const { makeRequester, createMockReq, runMiddlewareSync } = require('./helpers/authzFixtures');

describe('permissionCatalog', () => {
  it('defines 11 modules × 7 actions', () => {
    assert.equal(MODULES.length, 11);
    assert.equal(ACTIONS.length, 7);
    assert.equal(ALL_PERMISSION_CODES.length, 77);
  });

  it('reviewer defaults exclude write actions', () => {
    const codes = reviewerAllowedCodes();
    assert.ok(codes.every((c) => !isWritePermissionCode(c)));
    assert.ok(codes.includes('reports.view'));
    assert.ok(codes.includes('reports.export'));
    assert.equal(codes.includes('users.create'), false);
  });

  it('default matrix covers five roles', () => {
    const map = defaultRolePermissionMap();
    assert.equal(map.super_admin.length, 77);
    assert.ok(map.admin.length > 20);
    assert.ok(map.academic_reviewer.every((c) => !isWritePermissionCode(c)));
  });
});

describe('enforceAcademicReviewerReadOnly', () => {
  it('allows GET for academic_reviewer', () => {
    const req = createMockReq({
      method: 'GET',
      originalUrl: '/api/v1/academic/field-training/dashboard',
      user: makeRequester({ roles: ['academic_reviewer'], isGlobal: false }),
    });
    const out = runMiddlewareSync(enforceAcademicReviewerReadOnly, req);
    assert.equal(out.nextCalled, true);
  });

  it('blocks POST for academic_reviewer', () => {
    const req = createMockReq({
      method: 'POST',
      originalUrl: '/api/v1/admin/field-training/opportunities',
      user: makeRequester({ roles: ['academic_reviewer'], isGlobal: false }),
    });
    const out = runMiddlewareSync(enforceAcademicReviewerReadOnly, req);
    assert.equal(out.status, 403);
    assert.equal(out.body?.code, 'REVIEWER_READ_ONLY');
  });

  it('allows notification PATCH for academic_reviewer', () => {
    const req = createMockReq({
      method: 'PATCH',
      originalUrl: '/api/v1/notifications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/read',
      user: makeRequester({ roles: ['academic_reviewer'], isGlobal: false }),
    });
    const out = runMiddlewareSync(enforceAcademicReviewerReadOnly, req);
    assert.equal(out.nextCalled, true);
  });
});

describe('requirePermission', () => {
  it('denies write permission for academic_reviewer even if listed', () => {
    const mw = requirePermission('users.create');
    const req = createMockReq({
      user: makeRequester({
        roles: ['academic_reviewer'],
        isGlobal: false,
        permissions: ['users.create', 'users.view'],
      }),
    });
    // makeRequester may not pass permissions — set explicitly
    req.user.permissions = ['users.create', 'users.view'];
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.status, 403);
  });

  it('allows admin with matching permission', () => {
    const mw = requirePermission('users.view');
    const req = createMockReq({
      user: makeRequester({ roles: ['admin'], isGlobal: false }),
    });
    req.user.permissions = ['users.view'];
    const out = runMiddlewareSync(mw, req);
    assert.equal(out.nextCalled, true);
  });
});
