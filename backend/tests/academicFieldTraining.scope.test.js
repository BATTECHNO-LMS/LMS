'use strict';

/**
 * Academic / university_reviewer field-training scope characterization (pure).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const {
  withAcademicUniversity,
  ACADEMIC_UNIVERSITY_REQUIRED_MSG,
} = require('../src/modules/fieldTraining/fieldTrainingReport.service');
const {
  isFieldTrainingAdmin,
  canManageFieldTraining,
  assertStudentUniversityAccess,
} = require('../src/modules/fieldTraining/fieldTraining.access');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  makeRequester,
} = require('./helpers/authzFixtures');

describe('academic field training university scope', () => {
  it('withAcademicUniversity forces JWT university and rejects other university_id', () => {
    const user = makeRequester({
      roles: ['university_reviewer'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    const scoped = withAcademicUniversity(user, { status: 'pending' });
    assert.equal(scoped.university_id, SYNTH_UNI_A);
    assert.equal(scoped.status, 'pending');

    assert.throws(
      () => withAcademicUniversity(user, { university_id: SYNTH_UNI_B }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('withAcademicUniversity requires linked university', () => {
    const user = makeRequester({
      roles: ['university_reviewer'],
      universityId: null,
      isGlobal: false,
    });
    assert.throws(
      () => withAcademicUniversity(user, {}),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 400 &&
        String(err.message).includes('جامعة')
    );
    assert.equal(typeof ACADEMIC_UNIVERSITY_REQUIRED_MSG, 'string');
  });

  it('university_reviewer cannot manage field training write actions', () => {
    const reviewer = makeRequester({
      userId: SYNTH_USER_A,
      roles: ['university_reviewer'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    assert.equal(isFieldTrainingAdmin(reviewer), false);
    assert.equal(
      canManageFieldTraining(reviewer, {
        id: '00000000-0000-4000-8000-000000000099',
        assigned_instructor_id: null,
        university_id: SYNTH_UNI_A,
      }),
      false
    );
  });

  it('reviewer of UNI_A is forbidden from UNI_B student scope', () => {
    const reviewer = makeRequester({
      roles: ['university_reviewer'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
    });
    assert.throws(
      () => assertStudentUniversityAccess(reviewer, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.doesNotThrow(() => assertStudentUniversityAccess(reviewer, SYNTH_UNI_A));
  });
});
