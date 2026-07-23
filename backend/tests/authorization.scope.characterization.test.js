'use strict';

/**
 * Characterization: university scope + program_admin / isGlobal (current behavior).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isSystemWideAdmin,
  resolveUniversityIdFilter,
  assertUniversityRecordAccess,
  denyAllWhere,
} = require('../src/utils/universityScope');
const { ApiError } = require('../src/utils/apiError');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  makeRequester,
  makeGlobalSuperAdmin,
  makeProgramAdmin,
  CANONICAL_ROLES,
} = require('./helpers/authzFixtures');

describe('universityScope characterization', () => {
  it('isSystemWideAdmin: isGlobal true regardless of roles', () => {
    assert.equal(isSystemWideAdmin({ isGlobal: true, roles: [] }), true);
  });

  it('isSystemWideAdmin: program_admin is NOT system-wide (Phase 3 product change)', () => {
    assert.equal(isSystemWideAdmin(makeProgramAdmin()), false);
  });

  it('isSystemWideAdmin: other university roles are not system-wide', () => {
    for (const role of [
      'university_admin',
      'academic_admin',
      'qa_officer',
      'instructor',
      'student',
      'university_reviewer',
    ]) {
      assert.equal(
        isSystemWideAdmin(makeRequester({ roles: [role], isGlobal: false })),
        false,
        role
      );
    }
  });

  it('resolveUniversityIdFilter: system-wide may omit university filter', () => {
    assert.equal(resolveUniversityIdFilter(makeGlobalSuperAdmin(), null), undefined);
  });

  it('resolveUniversityIdFilter: system-wide may optionally filter by requested uni', () => {
    assert.equal(resolveUniversityIdFilter(makeGlobalSuperAdmin(), SYNTH_UNI_B), SYNTH_UNI_B);
  });

  it('resolveUniversityIdFilter: program_admin is scoped like other non-global roles (Phase 3)', () => {
    assert.equal(resolveUniversityIdFilter(makeProgramAdmin(), null), SYNTH_UNI_A);
    assert.throws(
      () => resolveUniversityIdFilter(makeProgramAdmin(), SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('resolveUniversityIdFilter: scoped user forced to JWT university', () => {
    assert.equal(
      resolveUniversityIdFilter(
        makeRequester({ roles: ['university_admin'], universityId: SYNTH_UNI_A }),
        null
      ),
      SYNTH_UNI_A
    );
  });

  it('resolveUniversityIdFilter: same-university request allowed', () => {
    assert.equal(
      resolveUniversityIdFilter(
        makeRequester({ roles: ['university_admin'], universityId: SYNTH_UNI_A }),
        SYNTH_UNI_A
      ),
      SYNTH_UNI_A
    );
  });

  it('resolveUniversityIdFilter: cross-university request → 403', () => {
    assert.throws(
      () =>
        resolveUniversityIdFilter(
          makeRequester({ roles: ['university_admin'], universityId: SYNTH_UNI_A }),
          SYNTH_UNI_B
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('resolveUniversityIdFilter: requested uni with missing JWT university → 403', () => {
    assert.throws(
      () =>
        resolveUniversityIdFilter(
          makeRequester({ roles: ['university_admin'], universityId: null }),
          SYNTH_UNI_A
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('assertUniversityRecordAccess: program_admin does not bypass (Phase 3)', () => {
    assert.throws(
      () => assertUniversityRecordAccess(makeProgramAdmin(), SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('assertUniversityRecordAccess: isGlobal bypasses record university', () => {
    assert.doesNotThrow(() => assertUniversityRecordAccess(makeGlobalSuperAdmin(), SYNTH_UNI_B));
  });

  it('assertUniversityRecordAccess: missing requester university → 403', () => {
    assert.throws(
      () =>
        assertUniversityRecordAccess(
          makeRequester({ roles: ['university_admin'], universityId: null }),
          SYNTH_UNI_A
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('assertUniversityRecordAccess: unresolved / missing record university → 403', () => {
    assert.throws(
      () =>
        assertUniversityRecordAccess(
          makeRequester({ roles: ['university_admin'], universityId: SYNTH_UNI_A }),
          null
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('assertUniversityRecordAccess: wrong university → 403', () => {
    assert.throws(
      () =>
        assertUniversityRecordAccess(
          makeRequester({ roles: ['academic_admin'], universityId: SYNTH_UNI_A }),
          SYNTH_UNI_B
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denyAllWhere returns empty id list sentinel', () => {
    assert.deepEqual(denyAllWhere(), { id: { in: [] } });
  });

  it('canonical role set used by fixtures has five codes', () => {
    assert.equal(CANONICAL_ROLES.length, 5);
    assert.ok(CANONICAL_ROLES.includes('admin'));
    assert.ok(CANONICAL_ROLES.includes('academic_reviewer'));
    assert.ok(CANONICAL_ROLES.includes('super_admin'));
    assert.ok(!CANONICAL_ROLES.includes('program_admin'));
  });
});
