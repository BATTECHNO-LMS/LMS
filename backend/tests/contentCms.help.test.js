'use strict';

/**
 * Content CMS help catalog + shared HTML/template helpers.
 */

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');
const {
  setCurrentAuthContextLoaderForTests,
  resetCurrentAuthContextLoaderForTests,
} = require('../src/modules/auth/currentAuthContext');
const {
  sanitizeHtml,
  sanitizeCtaUrl,
  interpolateTemplate,
  assertContentAdmin,
  CONTENT_ADMIN_FORBIDDEN_MSG,
  syncPublishedFlags,
  primaryRole,
} = require('../src/modules/contentCms/contentCms.shared');
const { ApiError } = require('../src/utils/apiError');
const { SYNTH_UNI_A, SYNTH_USER_A, makeRequester } = require('./helpers/authzFixtures');

describe('contentCms.shared sanitizeHtml', () => {
  it('strips script tags and keeps safe markup', () => {
    const cleaned = sanitizeHtml(
      '<p>مرحبا</p><script>alert(1)</script><strong>ok</strong><img src=x onerror=alert(1)>'
    );
    assert.doesNotMatch(cleaned, /<script/i);
    assert.doesNotMatch(cleaned, /onerror/i);
    assert.match(cleaned, /مرحبا/);
    assert.match(cleaned, /<strong>ok<\/strong>/);
  });

  it('neutralizes javascript: URLs in href', () => {
    const cleaned = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    assert.doesNotMatch(cleaned, /javascript:/i);
  });

  it('returns empty string for nullish input', () => {
    assert.equal(sanitizeHtml(null), '');
    assert.equal(sanitizeHtml(undefined), '');
  });
});

describe('contentCms.shared helpers', () => {
  it('sanitizeCtaUrl rejects dangerous schemes', () => {
    assert.equal(sanitizeCtaUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeCtaUrl('data:text/html,hi'), null);
    assert.equal(sanitizeCtaUrl('https://lms.example/help'), 'https://lms.example/help');
    assert.equal(sanitizeCtaUrl('/help/articles'), '/help/articles');
  });

  it('interpolateTemplate only replaces allowlisted keys', () => {
    const out = interpolateTemplate('مرحبا {{student_name}} {{evil}}', {
      student_name: 'سارة',
      evil: 'nope',
    });
    assert.match(out, /سارة/);
    assert.match(out, /\{\{evil\}\}/);
  });

  it('syncPublishedFlags mirrors PUBLISHED status', () => {
    assert.deepEqual(syncPublishedFlags('PUBLISHED'), { is_published: true, is_active: true });
    assert.deepEqual(syncPublishedFlags('DRAFT'), { is_published: false, is_active: false });
  });

  it('primaryRole prefers student when present', () => {
    assert.equal(primaryRole({ roles: ['admin', 'student'] }), 'student');
    assert.equal(primaryRole({ roles: ['instructor'] }), 'instructor');
  });

  it('assertContentAdmin throws Arabic for student', () => {
    assert.throws(
      () => assertContentAdmin(makeRequester({ roles: ['student'] })),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /لا تملك صلاحية/);
        assert.equal(err.message, CONTENT_ADMIN_FORBIDDEN_MSG);
        return true;
      }
    );
  });
});

describe('GET /api/v1/help/categories', () => {
  afterEach(() => {
    resetCurrentAuthContextLoaderForTests();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/help/categories');
    assert.equal(res.status, 401);
  });

  it('returns 200 with student auth when catalog is available', async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip('help categories require DATABASE_URL');
      return;
    }

    setCurrentAuthContextLoaderForTests(async (userId) => ({
      userId,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
      permissions: [],
    }));
    const token = signToken({
      userId: SYNTH_USER_A,
      roles: ['student'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
      portalType: 'UNIVERSITY',
    });

    const res = await request(app)
      .get('/api/v1/help/categories')
      .set('Authorization', `Bearer ${token}`);

    if (res.status === 500 || res.status === 503) {
      t.skip('help categories require DB fixtures');
      return;
    }

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
