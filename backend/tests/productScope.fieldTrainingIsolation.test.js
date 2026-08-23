'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { requireOrganizationType } = require('../src/middlewares/authorization.middleware');
const { resolveUniversityIdFilter, isSystemWideAdmin } = require('../src/utils/universityScope');
const { scopeAdminListQuery } = require('../src/modules/fieldTraining/fieldTraining.access');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function runMw(mw, user) {
  const req = { user };
  const res = mockRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

describe('product scope Field Training isolation', () => {
  it('institution admin is denied on UNIVERSITY organization middleware', () => {
    const mw = requireOrganizationType('UNIVERSITY');
    const { res, nextCalled } = runMw(mw, {
      isGlobal: false,
      organizationType: 'INSTITUTION',
      universityId: null,
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PORTAL_MISMATCH');
  });

  it('university admin is allowed on UNIVERSITY organization middleware', () => {
    const mw = requireOrganizationType('UNIVERSITY');
    const { res, nextCalled } = runMw(mw, {
      isGlobal: false,
      organizationType: 'UNIVERSITY',
      universityId: '11111111-1111-1111-1111-111111111111',
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('super admin (isGlobal) bypasses organization type', () => {
    const mw = requireOrganizationType('UNIVERSITY');
    const { nextCalled } = runMw(mw, {
      isGlobal: true,
      organizationType: 'INSTITUTION',
    });
    assert.equal(nextCalled, true);
  });

  it('null universityId for a normal admin is not global access', () => {
    assert.equal(isSystemWideAdmin({ isGlobal: false, universityId: null }), false);
    assert.equal(
      resolveUniversityIdFilter({ isGlobal: false, universityId: null }, null),
      undefined
    );
    const scoped = scopeAdminListQuery(
      { isGlobal: false, universityId: null, roles: ['admin'] },
      { page: 1, page_size: 20 }
    );
    assert.equal(scoped.university_id, '00000000-0000-0000-0000-000000000000');
  });
});
