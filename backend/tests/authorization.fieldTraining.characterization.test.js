'use strict';

/**
 * Characterization: field-training access helpers (pure / sync paths only).
 * Does not call prisma-backed assertApplicationStudentAccess.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const {
  isFieldTrainingAdmin,
  isUniversityScopedFieldTrainingUser,
  isAssignedInstructor,
  canManageFieldTraining,
  manageOpportunityListWhere,
  assertStudentUniversityAccess,
  UNIVERSITY_FORBIDDEN_MSG,
} = require('../src/modules/fieldTraining/fieldTraining.access');
const { isSystemWideAdmin } = require('../src/utils/universityScope');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  SYNTH_USER_B,
  SYNTH_OPP,
  makeRequester,
  makeGlobalSuperAdmin,
  makeProgramAdmin,
} = require('./helpers/authzFixtures');

const opportunity = {
  id: SYNTH_OPP,
  assigned_instructor_id: SYNTH_USER_B,
  university_id: SYNTH_UNI_A,
};

describe('fieldTraining.access characterization', () => {
  it('isFieldTrainingAdmin: system-wide isGlobal only; program_admin denied (Phase 3)', () => {
    assert.equal(isFieldTrainingAdmin(makeGlobalSuperAdmin()), true);
    assert.equal(isFieldTrainingAdmin(makeProgramAdmin()), false);
  });

  it('isFieldTrainingAdmin: university_admin and academic_admin (default env)', () => {
    assert.equal(
      isFieldTrainingAdmin(makeRequester({ roles: ['university_admin'], isGlobal: false })),
      true
    );
    assert.equal(
      isFieldTrainingAdmin(makeRequester({ roles: ['academic_admin'], isGlobal: false })),
      true
    );
  });

  it('isFieldTrainingAdmin: student / instructor / reviewer false (unless system-wide)', () => {
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['student'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['instructor'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['university_reviewer'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['qa_officer'] })), false);
  });

  it('isUniversityScopedFieldTrainingUser: false for isGlobal; program_admin not FT admin (Phase 3)', () => {
    assert.equal(isUniversityScopedFieldTrainingUser(makeProgramAdmin()), false);
    assert.equal(isUniversityScopedFieldTrainingUser(makeGlobalSuperAdmin()), false);
  });

  it('isUniversityScopedFieldTrainingUser: true for uni staff with universityId', () => {
    for (const role of ['university_admin', 'academic_admin', 'university_reviewer', 'qa_officer']) {
      assert.equal(
        isUniversityScopedFieldTrainingUser(
          makeRequester({ roles: [role], universityId: SYNTH_UNI_A, isGlobal: false })
        ),
        true,
        role
      );
    }
  });

  it('isUniversityScopedFieldTrainingUser: false without universityId', () => {
    assert.equal(
      isUniversityScopedFieldTrainingUser(
        makeRequester({ roles: ['university_admin'], universityId: null })
      ),
      false
    );
  });

  it('isAssignedInstructor: owner instructor only', () => {
    assert.equal(
      isAssignedInstructor(
        makeRequester({ userId: SYNTH_USER_B, roles: ['instructor'] }),
        opportunity
      ),
      true
    );
    assert.equal(
      isAssignedInstructor(
        makeRequester({ userId: SYNTH_USER_A, roles: ['instructor'] }),
        opportunity
      ),
      false
    );
    assert.equal(
      isAssignedInstructor(
        makeRequester({ userId: SYNTH_USER_B, roles: ['university_admin'] }),
        opportunity
      ),
      false
    );
  });

  it('canManageFieldTraining: university admin, assigned instructor, or isGlobal — not program_admin', () => {
    assert.equal(canManageFieldTraining(makeProgramAdmin(), opportunity), false);
    assert.equal(
      canManageFieldTraining(
        makeRequester({
          userId: SYNTH_USER_A,
          roles: ['university_admin'],
          universityId: SYNTH_UNI_A,
          isGlobal: false,
        }),
        opportunity
      ),
      true
    );
    assert.equal(
      canManageFieldTraining(
        makeRequester({ userId: SYNTH_USER_B, roles: ['instructor'] }),
        opportunity
      ),
      true
    );
    assert.equal(
      canManageFieldTraining(
        makeRequester({ userId: SYNTH_USER_A, roles: ['instructor'] }),
        opportunity
      ),
      false
    );
    assert.equal(canManageFieldTraining(makeRequester({ roles: ['student'] }), opportunity), false);
  });

  it('manageOpportunityListWhere: isGlobal unrestricted; program_admin denied list', () => {
    assert.deepEqual(manageOpportunityListWhere(makeGlobalSuperAdmin()), {});
    assert.deepEqual(manageOpportunityListWhere(makeProgramAdmin()), { id: { in: [] } });
  });

  it('manageOpportunityListWhere: instructor scoped to assigned_instructor_id', () => {
    const where = manageOpportunityListWhere(
      makeRequester({ userId: SYNTH_USER_A, roles: ['instructor'], universityId: SYNTH_UNI_A })
    );
    assert.deepEqual(where, { assigned_instructor_id: SYNTH_USER_A });
  });

  it('manageOpportunityListWhere: non-admin non-instructor → denyAll', () => {
    const where = manageOpportunityListWhere(makeRequester({ roles: ['student'] }));
    assert.deepEqual(where, { id: { in: [] } });
  });

  it('assertStudentUniversityAccess: same university allowed for scoped staff', () => {
    assert.doesNotThrow(() =>
      assertStudentUniversityAccess(
        makeRequester({ roles: ['university_admin'], universityId: SYNTH_UNI_A }),
        SYNTH_UNI_A
      )
    );
  });

  it('assertStudentUniversityAccess: cross-university denied for scoped staff', () => {
    assert.throws(
      () =>
        assertStudentUniversityAccess(
          makeRequester({ roles: ['academic_admin'], universityId: SYNTH_UNI_A }),
          SYNTH_UNI_B
        ),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 403 &&
        String(err.message).includes('جامعة')
    );
    assert.match(UNIVERSITY_FORBIDDEN_MSG, /جامعة/);
  });

  it('assertStudentUniversityAccess: program_admin does not bypass (Phase 3)', () => {
    const pa = makeProgramAdmin();
    assert.equal(isSystemWideAdmin(pa), false);
    assert.equal(isFieldTrainingAdmin(pa), false);
    // Not system-wide and not FT-scoped: no privileged cross-uni bypass path.
    assert.equal(isUniversityScopedFieldTrainingUser(pa), false);
    assert.doesNotThrow(() => assertStudentUniversityAccess(pa, SYNTH_UNI_B));
  });
});
