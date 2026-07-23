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
  it('isFieldTrainingAdmin: system-wide isGlobal; admin allowed', () => {
    assert.equal(isFieldTrainingAdmin(makeGlobalSuperAdmin()), true);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['admin'], isGlobal: false })), true);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['student'], isGlobal: false })), false);
  });

  it('isFieldTrainingAdmin: legacy JWT aliases map to admin', () => {
    assert.equal(
      isFieldTrainingAdmin(makeRequester({ roles: ['university_admin'], isGlobal: false })),
      true
    );
    assert.equal(
      isFieldTrainingAdmin(makeRequester({ roles: ['academic_admin'], isGlobal: false })),
      true
    );
    assert.equal(isFieldTrainingAdmin(makeProgramAdmin()), true);
  });

  it('isFieldTrainingAdmin: student / instructor / reviewer false (unless system-wide)', () => {
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['student'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['instructor'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['academic_reviewer'] })), false);
    assert.equal(isFieldTrainingAdmin(makeRequester({ roles: ['university_reviewer'] })), false);
  });

  it('isUniversityScopedFieldTrainingUser: false for isGlobal', () => {
    assert.equal(isUniversityScopedFieldTrainingUser(makeGlobalSuperAdmin()), false);
  });

  it('isUniversityScopedFieldTrainingUser: true for uni staff with universityId', () => {
    for (const role of ['admin', 'academic_reviewer', 'university_admin', 'university_reviewer']) {
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
        makeRequester({ roles: ['admin'], universityId: null })
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

  it('canManageFieldTraining: admin, assigned instructor, or isGlobal', () => {
    assert.equal(canManageFieldTraining(makeProgramAdmin(), opportunity), true);
    assert.equal(
      canManageFieldTraining(
        makeRequester({
          userId: SYNTH_USER_A,
          roles: ['admin'],
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

  it('manageOpportunityListWhere: isGlobal unrestricted; admin scoped by eligibility', () => {
    assert.deepEqual(manageOpportunityListWhere(makeGlobalSuperAdmin()), {});
    assert.deepEqual(manageOpportunityListWhere(makeProgramAdmin()), {
      field_training_opportunity_eligibility: {
        some: {
          is_active: true,
          university_id: SYNTH_UNI_A,
        },
      },
    });
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

  it('assertStudentUniversityAccess: legacy program_admin aliases to admin FT scope', () => {
    const pa = makeProgramAdmin();
    assert.equal(isSystemWideAdmin(pa), false);
    assert.equal(isFieldTrainingAdmin(pa), true);
    assert.equal(isUniversityScopedFieldTrainingUser(pa), true);
    assert.throws(
      () => assertStudentUniversityAccess(pa, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });
});
