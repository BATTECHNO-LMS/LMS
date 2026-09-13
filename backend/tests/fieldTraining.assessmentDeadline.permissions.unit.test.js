'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { canManageFieldTraining } = require('../src/modules/fieldTraining/fieldTraining.access');
const { resolveUniversityIdFilter, assertUniversityRecordAccess } = require('../src/utils/universityScope');
const { ApiError } = require('../src/utils/apiError');

const ROOT = path.join(__dirname, '..');
const ZARQA_ID = '4b85f423-c543-499e-9765-a5248dbfa583';
const OTHER_UNI = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('Field Training PRE/POST deadline permissions', () => {
  it('lets super_admin and zarqa admin manage, but not reviewer or student', () => {
    const opp = { id: 'opp', university_id: ZARQA_ID, assigned_instructor_id: null };
    assert.equal(canManageFieldTraining({ isGlobal: true, roles: ['super_admin'] }, opp), true);
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_ID, roles: ['admin'] }, opp),
      true
    );
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_ID, roles: ['reviewer'] }, opp),
      false
    );
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_ID, roles: ['student'] }, opp),
      false
    );
  });

  it('blocks another university admin from Zarqa records', () => {
    const otherAdmin = { isGlobal: false, universityId: OTHER_UNI, roles: ['admin'] };
    assert.equal(resolveUniversityIdFilter(otherAdmin, null), OTHER_UNI);
    assert.throws(
      () => assertUniversityRecordAccess(otherAdmin, ZARQA_ID),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('keeps reviewer academic routes read-only for assessments', () => {
    const academic = read('src/modules/fieldTraining/academicFieldTraining.routes.js');
    assert.equal(/assessments\/:assessmentId/.test(academic), false);
    assert.equal(/publishAssessment/.test(academic), false);
    assert.match(academic, /authorizeRoles\('admin', 'reviewer'\)/);
  });

  it('does not expose assessment write endpoints on student routes', () => {
    const student = read('src/modules/fieldTraining/studentFieldTraining.routes.js');
    assert.equal(/router\.patch\(\s*'\/assessments/.test(student), false);
    assert.match(student, /assessments\/:type\/submit/);
    assert.match(student, /assessments\/:type\/save/);
  });

  it('scopes deadline enforcement to Field Training workflow, not course quizzes', () => {
    const workflow = read('src/modules/fieldTraining/fieldTraining.workflowService.js');
    const training = read('src/modules/trainingPrograms/trainingAssessment.service.js');
    assert.match(workflow, /assessmentDeadline\.assertNotClosed/);
    assert.match(workflow, /assessmentDeadline\.assertStudentWindow/);
    assert.equal(training.includes('fieldTraining.assessmentDeadline'), false);
  });

  it('does not add PRE into the final 20/20/40/20 Field Training score model', () => {
    const policy = read('src/modules/fieldTraining/fieldTraining.policy.service.js');
    assert.match(policy, /FIXED_COMPONENTS_20_20_40_20_V1/);
    const zarqa = read('src/modules/fieldTraining/fieldTraining.zarqaPreAssessment.js');
    assert.match(zarqa, /لا تُحتسب نتيجته ضمن العلامة النهائية \/100/);
  });

  it('uses additive nullable migration without backfilling closes_at', () => {
    const sql = read(
      'prisma/migrations/20260912120000_field_training_assessment_closes_at/migration.sql'
    );
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "closes_at"/);
    assert.equal(/UPDATE\s+"field_training_assessments"/i.test(sql), false);
    assert.equal(/DROP COLUMN/i.test(sql), false);
    assert.equal(/SET\s+"closes_at"/i.test(sql), false);
  });
});
