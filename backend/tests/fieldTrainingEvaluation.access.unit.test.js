'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const access = require('../src/modules/fieldTraining/fieldTrainingEvaluation.access');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  SYNTH_USER_B,
  SYNTH_OPP,
  makeRequester,
  makeGlobalSuperAdmin,
} = require('./helpers/authzFixtures');

const evaluationA = {
  id: 'ev-a',
  university_id: SYNTH_UNI_A,
  student_id: SYNTH_USER_A,
  opportunity_id: SYNTH_OPP,
};
const evaluationB = {
  id: 'ev-b',
  university_id: SYNTH_UNI_B,
  student_id: SYNTH_USER_B,
  opportunity_id: '44444444-4444-4444-8444-444444444444',
};

describe('field training evaluation security', () => {
  it('allows Super Admin global template and report access', () => {
    const admin = makeGlobalSuperAdmin();
    assert.doesNotThrow(() => access.assertCanManageUniversityTemplates(admin, SYNTH_UNI_B));
    assert.doesNotThrow(() => access.assertCanViewReports(admin, SYNTH_UNI_A));
    assert.doesNotThrow(() => access.assertCanDownloadEvaluation(admin, evaluationB));
  });

  it('allows University Admin for own university only', () => {
    const uniAdmin = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => access.assertCanManageUniversityTemplates(uniAdmin, SYNTH_UNI_A));
    assert.throws(
      () => access.assertCanManageUniversityTemplates(uniAdmin, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('allows assigned instructor and denies unassigned', () => {
    const instructor = makeRequester({ roles: ['instructor'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    const assigned = { assigned_instructor_id: SYNTH_USER_A, university_id: SYNTH_UNI_A };
    const other = { assigned_instructor_id: SYNTH_USER_B, university_id: SYNTH_UNI_A };
    assert.doesNotThrow(() => access.assertCanGenerate(instructor, assigned));
    assert.throws(
      () => access.assertCanGenerate(instructor, other),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('keeps reviewer read-only and scoped', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => access.assertCanViewReports(reviewer, SYNTH_UNI_A));
    assert.doesNotThrow(() => access.assertCanDownloadEvaluation(reviewer, evaluationA));
    assert.throws(
      () => access.assertCanGenerate(reviewer, { university_id: SYNTH_UNI_A }),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'REPORT_READ_ONLY'
    );
    assert.throws(
      () => access.assertCanViewReports(reviewer, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies Institution Admin / trainer / trainee', () => {
    const inst = makeRequester({
      roles: ['admin'],
      universityId: SYNTH_UNI_A,
      organizationType: 'INSTITUTION',
      portalType: 'INSTITUTION',
    });
    assert.throws(
      () => access.assertCanViewReports(inst, SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.throws(
      () => access.assertCanManageUniversityTemplates(makeRequester({ roles: ['trainer'], universityId: SYNTH_UNI_A }), SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.throws(
      () => access.assertCanViewReports(makeRequester({ roles: ['trainee'], universityId: SYNTH_UNI_A }), SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies null universityId for non-global users', () => {
    const admin = makeRequester({ roles: ['admin'], universityId: null });
    assert.throws(
      () => access.assertCanManageUniversityTemplates(admin, null),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies cross-student report IDOR', () => {
    const student = makeRequester({ roles: ['student'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => access.assertCanDownloadEvaluation(student, evaluationA));
    assert.throws(
      () => access.assertCanDownloadEvaluation(student, evaluationB),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies cross-university ZIP mixing', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A });
    const filtered = access.filterEvaluationsForZip(reviewer, [evaluationA, evaluationB]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'ev-a');
  });
});
