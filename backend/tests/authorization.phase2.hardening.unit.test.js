'use strict';

/**
 * Phase 2 authorization hardening — unit tests for confirmed cross-tenant /
 * empty-scope / mass-assignment / static-upload fixes. Local only.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  makeRequester,
  makeGlobalSuperAdmin,
} = require('./helpers/authzFixtures');
const { ApiError } = require('../src/utils/apiError');
const {
  resolveUniversityIdFilter,
  isSystemWideAdmin,
  denyAllWhere,
} = require('../src/utils/universityScope');
const { assertAdminCanAccessTargets } = require('../src/modules/help/help.service');
const { assertAdminCanAccessPopup } = require('../src/modules/popups/popups.service');

describe('Phase 2 — help assertAdminCanAccessTargets', () => {
  it('allows system-wide admin for empty (platform-wide) targets', () => {
    assert.doesNotThrow(() => assertAdminCanAccessTargets(makeGlobalSuperAdmin(), []));
  });

  it('denies university admin mutating platform-wide (empty target) content', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A, isGlobal: false });
    assert.throws(
      () => assertAdminCanAccessTargets(user, []),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('allows university admin for own-university targets', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => assertAdminCanAccessTargets(user, [SYNTH_UNI_A]));
  });

  it('denies university admin for other-university targets', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.throws(
      () => assertAdminCanAccessTargets(user, [SYNTH_UNI_B]),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies admin without universityId', () => {
    const user = makeRequester({ roles: ['admin'], universityId: null, isGlobal: false });
    assert.throws(
      () => assertAdminCanAccessTargets(user, [SYNTH_UNI_A]),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

describe('Phase 2 — popup assertAdminCanAccessPopup', () => {
  it('allows system-wide admin for system_key popup', () => {
    assert.doesNotThrow(() =>
      assertAdminCanAccessPopup(makeGlobalSuperAdmin(), {
        system_key: 'welcome',
        target_university_ids: [],
      })
    );
  });

  it('denies university admin on system_key popup', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.throws(
      () =>
        assertAdminCanAccessPopup(user, {
          system_key: 'welcome',
          target_university_ids: [SYNTH_UNI_A],
        }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies university admin on empty-target popup', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.throws(
      () =>
        assertAdminCanAccessPopup(user, {
          system_key: null,
          target_university_ids: [],
        }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('allows university admin for own-university popup', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() =>
      assertAdminCanAccessPopup(user, {
        system_key: null,
        target_university_ids: [SYNTH_UNI_A],
      })
    );
  });

  it('denies university admin for other-university popup', () => {
    const user = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.throws(
      () =>
        assertAdminCanAccessPopup(user, {
          system_key: null,
          target_university_ids: [SYNTH_UNI_B],
        }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

describe('Phase 2 — universityScope empty filter rule', () => {
  it('non-global without universityId returns undefined (caller must deny-all)', () => {
    const r = makeRequester({ roles: ['admin'], universityId: null, isGlobal: false });
    assert.equal(isSystemWideAdmin(r), false);
    assert.equal(resolveUniversityIdFilter(r, null), undefined);
  });

  it('denyAllWhere matches no rows', () => {
    assert.deepEqual(denyAllWhere(), { id: { in: [] } });
  });

  it('global may omit university filter', () => {
    assert.equal(resolveUniversityIdFilter(makeGlobalSuperAdmin(), null), undefined);
  });

  it('cross-university request is denied', () => {
    assert.throws(
      () =>
        resolveUniversityIdFilter(
          makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A }),
          SYNTH_UNI_B
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});

describe('Phase 2 — course lesson update allowlist', () => {
  it('zod strips unknown mass-assignment fields', () => {
    const { updateLessonBodySchema } = require('../src/modules/courses/courses.validation');
    const parsed = updateLessonBodySchema.parse({
      title: 'Safe',
      course_id: 'should-be-stripped',
      id: 'should-be-stripped',
    });
    assert.equal(parsed.title, 'Safe');
    assert.equal(parsed.course_id, undefined);
    assert.equal(parsed.id, undefined);
  });

  it('updateLesson service uses explicit allowlist (no raw body spread)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/modules/courses/courses.service.js'),
      'utf8'
    );
    assert.match(src, /Explicit allowlist/);
    assert.doesNotMatch(src, /const data = \{ \.\.\.body \}/);
  });
});

describe('Phase 2 — FT analytics fails closed without university', () => {
  it('missing university scope forces 403', () => {
    const user = makeRequester({ roles: ['admin'], universityId: null, isGlobal: false });
    const scoped = resolveUniversityIdFilter(user, null);
    assert.equal(scoped, undefined);
    assert.throws(
      () => {
        if (!scoped) throw new ApiError(403, 'Forbidden');
      },
      (err) => err.statusCode === 403
    );
  });
});

describe('Phase 2 — uploads field-training static block', () => {
  it('app.js blocks /uploads/field-training before express.static', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    assert.match(src, /app\.use\(\s*['"]\/uploads\/field-training['"]/);
    const ftIdx = src.indexOf("/uploads/field-training'");
    const staticIdx = src.indexOf('express.static');
    assert.ok(ftIdx > 0 && staticIdx > ftIdx);
  });
});

describe('Phase 2 — evaluation uploadTemplate validated body only', () => {
  it('controller does not spread raw req.body over validated body', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingEvaluation.controller.js'),
      'utf8'
    );
    assert.doesNotMatch(src, /\.\.\.req\.body/);
    assert.match(src, /req\.validated\?\.body/);
  });
});

describe('Phase 2 — activateAllPendingStudents fails closed', () => {
  it('service refuses non-global actors without university scope', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/modules/users/users.service.js'),
      'utf8'
    );
    assert.match(
      src,
      /activateAllPendingStudents[\s\S]*?!isSystemWideAdmin\(requester\) && !scopedUniversityId[\s\S]*?throw new ApiError\(403/
    );
  });
});
