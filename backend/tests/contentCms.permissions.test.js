'use strict';

/**
 * Content CMS permission gates: assertContentAdmin + admin write surfaces.
 * Prefers unit/characterization (no DB) over full HTTP integration.
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');
const { ApiError } = require('../src/utils/apiError');
const { errorMiddleware } = require('../src/middlewares/error.middleware');
const { authorizeRoles } = require('../src/middlewares/authorization.middleware');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const {
  assertContentAdmin,
  CONTENT_ADMIN_FORBIDDEN_MSG,
} = require('../src/modules/contentCms/contentCms.shared');
const helpService = require('../src/modules/help/help.service');
const announcementsService = require('../src/modules/announcements/announcements.service');
const popupsService = require('../src/modules/popups/popups.service');
const {
  SYNTH_UNI_A,
  SYNTH_USER_A,
  makeRequester,
  createMockReq,
  runMiddlewareSync,
} = require('./helpers/authzFixtures');

const DENIED_ROLES = ['student', 'instructor', 'reviewer'];
const ADMIN_POST_PATHS = [
  '/api/v1/admin/help/articles',
  '/api/v1/admin/announcements',
  '/api/v1/admin/popups',
];

function expectContentAdminForbidden(err) {
  assert.ok(err instanceof ApiError);
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, 'CONTENT_ADMIN_FORBIDDEN');
  assert.match(err.message, /لا تملك صلاحية/);
  assert.equal(err.message, CONTENT_ADMIN_FORBIDDEN_MSG);
  return true;
}

function requireContentAdmin(req, _res, next) {
  try {
    assertContentAdmin(req.user);
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Characterization app: mocked user + assertContentAdmin on CMS admin POSTs. */
function mountContentAdminGateApp() {
  const gate = express();
  gate.use(express.json());
  gate.use((req, _res, next) => {
    const rolesHeader = req.headers['x-test-roles'];
    const roles = rolesHeader
      ? String(rolesHeader)
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean)
      : [];
    req.user = {
      userId: SYNTH_USER_A,
      roles,
      universityId: SYNTH_UNI_A,
      isGlobal: req.headers['x-test-global'] === '1',
    };
    next();
  });
  for (const path of ADMIN_POST_PATHS) {
    gate.post(path, requireContentAdmin, (_req, res) => {
      res.status(201).json({ success: true });
    });
  }
  gate.use(errorMiddleware);
  return gate;
}

function mirrorAuth(roles, overrides = {}) {
  setCurrentAuthContextLoaderForTests(async (userId) => ({
    userId,
    roles,
    universityId: overrides.universityId === undefined ? SYNTH_UNI_A : overrides.universityId,
    isGlobal: Boolean(overrides.isGlobal),
    permissions: [],
  }));
}

function tokenFor(roles, overrides = {}) {
  return signToken({
    userId: SYNTH_USER_A,
    roles,
    universityId: overrides.universityId === undefined ? SYNTH_UNI_A : overrides.universityId,
    isGlobal: Boolean(overrides.isGlobal),
  });
}

describe('assertContentAdmin unit', () => {
  for (const role of DENIED_ROLES) {
    it(`throws 403 Arabic CONTENT_ADMIN_FORBIDDEN for ${role}`, () => {
      assert.throws(
        () => assertContentAdmin(makeRequester({ roles: [role], isGlobal: false })),
        expectContentAdminForbidden
      );
    });
  }

  it('allows super_admin role', () => {
    assert.doesNotThrow(() =>
      assertContentAdmin(makeRequester({ roles: ['super_admin'], isGlobal: false, universityId: null }))
    );
  });

  it('allows admin role', () => {
    assert.doesNotThrow(() =>
      assertContentAdmin(makeRequester({ roles: ['admin'], isGlobal: false }))
    );
  });

  it('allows isGlobal even without admin role', () => {
    assert.doesNotThrow(() =>
      assertContentAdmin(makeRequester({ roles: ['student'], isGlobal: true, universityId: null }))
    );
  });

  it('throws for missing user', () => {
    assert.throws(() => assertContentAdmin(null), expectContentAdminForbidden);
  });
});

describe('content admin services reject non-admins before DB', () => {
  for (const role of DENIED_ROLES) {
    it(`help.adminCreateArticle denies ${role}`, async () => {
      await assert.rejects(
        () => helpService.adminCreateArticle(makeRequester({ roles: [role] }), {}),
        expectContentAdminForbidden
      );
    });

    it(`announcements.createAnnouncement denies ${role}`, async () => {
      await assert.rejects(
        () => announcementsService.createAnnouncement(makeRequester({ roles: [role] }), {}),
        expectContentAdminForbidden
      );
    });

    it(`popups.adminCreatePopup denies ${role}`, async () => {
      await assert.rejects(
        () => popupsService.adminCreatePopup(makeRequester({ roles: [role] }), {}),
        expectContentAdminForbidden
      );
    });
  }
});

describe('content admin POST characterization (assertContentAdmin gate)', () => {
  const gateApp = mountContentAdminGateApp();

  for (const role of DENIED_ROLES) {
    for (const path of ADMIN_POST_PATHS) {
      it(`${role} gets 403 Arabic on POST ${path}`, async () => {
        const res = await request(gateApp).post(path).set('x-test-roles', role).send({});
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'CONTENT_ADMIN_FORBIDDEN');
        assert.match(String(res.body.message || ''), /لا تملك صلاحية/);
      });
    }
  }

  it('admin is allowed through the gate', async () => {
    const res = await request(gateApp)
      .post('/api/v1/admin/help/articles')
      .set('x-test-roles', 'admin')
      .send({});
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
  });
});

describe('authorizeRoles content-admin allowlist', () => {
  const mw = authorizeRoles('super_admin', 'admin');

  for (const role of DENIED_ROLES) {
    it(`denies ${role} with 403`, () => {
      const out = runMiddlewareSync(
        mw,
        createMockReq({ user: makeRequester({ roles: [role], isGlobal: false }) })
      );
      assert.equal(out.status, 403);
      assert.equal(out.nextCalled, false);
    });
  }

  it('allows admin', () => {
    const out = runMiddlewareSync(
      mw,
      createMockReq({ user: makeRequester({ roles: ['admin'], isGlobal: false }) })
    );
    assert.equal(out.nextCalled, true);
  });
});

describe('HTTP admin CMS POST auth (real app)', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  for (const path of ADMIN_POST_PATHS) {
    it(`POST ${path} returns 401 without auth`, async () => {
      const res = await request(app).post(path).send({});
      assert.equal(res.status, 401);
    });
  }

  for (const role of DENIED_ROLES) {
    for (const path of ADMIN_POST_PATHS) {
      it(`POST ${path} returns 403 for ${role} JWT`, async () => {
        mirrorAuth([role]);
        const res = await request(app)
          .post(path)
          .set('Authorization', `Bearer ${tokenFor([role])}`)
          .send({});
        assert.equal(res.status, 403);
        // authorizeRoles → Forbidden; assertContentAdmin → Arabic; reviewer read-only gate first.
        assert.match(
          String(res.body.message || ''),
          /لا تملك صلاحية|Forbidden|read-only/i
        );
      });
    }
  }
});
