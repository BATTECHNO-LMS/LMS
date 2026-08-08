'use strict';

/**
 * ISS-002 remediation regression (database-free):
 * academic submission/grade validators, route surface, service ownership/deadline
 * contracts, unauthenticated denial, and FE write client presence.
 * Field-training routes remain a separate module.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');

const {
  createSubmissionBodySchema,
  updateSubmissionBodySchema,
} = require('../src/modules/submissions/submissions.validation');
const {
  createGradeBodySchema,
  updateGradeBodySchema,
} = require('../src/modules/grades/grades.validation');
const { env } = require('../src/config/env');

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const ASSESSMENT_ID = '22222222-2222-4222-8222-222222222222';
const SUBMISSION_ID = '33333333-3333-4333-8333-333333333333';
const GRADE_ID = '44444444-4444-4444-8444-444444444444';

function readSrc(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}

describe('ISS-002 academic delivery remediation (backend)', () => {
  it('submission create validator requires type; accepts text/URL fields only', () => {
    assert.equal(
      createSubmissionBodySchema.safeParse({
        submission_type: 'text_response',
        text_response: 'hello',
      }).success,
      true
    );
    assert.equal(createSubmissionBodySchema.safeParse({ text_response: 'x' }).success, false);
    assert.equal(
      createSubmissionBodySchema.safeParse({
        submission_type: 'file',
        file_url: 'https://example.com/a.pdf',
      }).success,
      true
    );
    assert.equal(
      createSubmissionBodySchema.safeParse({
        submission_type: 'text_response',
        unknown_field: true,
      }).success,
      false
    );
  });

  it('submission update rejects empty body', () => {
    assert.equal(updateSubmissionBodySchema.safeParse({}).success, false);
    assert.equal(
      updateSubmissionBodySchema.safeParse({ text_response: 'updated' }).success,
      true
    );
  });

  it('grade validators enforce score 0–100 and feedback length', () => {
    assert.equal(
      createGradeBodySchema.safeParse({ student_id: STUDENT_ID, score: 0 }).success,
      true
    );
    assert.equal(
      createGradeBodySchema.safeParse({ student_id: STUDENT_ID, score: 100 }).success,
      true
    );
    assert.equal(
      createGradeBodySchema.safeParse({ student_id: STUDENT_ID, score: -1 }).success,
      false
    );
    assert.equal(
      createGradeBodySchema.safeParse({ student_id: STUDENT_ID, score: 101 }).success,
      false
    );
    assert.equal(updateGradeBodySchema.safeParse({}).success, false);
    assert.equal(updateGradeBodySchema.safeParse({ score: 88, feedback: 'ok' }).success, true);
  });

  it('default ACADEMIC_WRITE includes admin+instructor and excludes student/reviewer', () => {
    const write = env.ACADEMIC_WRITE_ROLE_CODES;
    assert.ok(write.includes('instructor'));
    assert.ok(write.includes('admin'));
    assert.equal(write.includes('student'), false);
    assert.equal(write.includes('reviewer'), false);
    assert.equal(write.includes('qa_officer'), false);
    assert.equal(write.includes('university_reviewer'), false);
  });

  it('createForAssessment encodes student-only, enrollment, deadline late/submitted, final-grade lock', () => {
    const src = readSrc('src', 'modules', 'submissions', 'submissions.service.js');
    assert.match(src, /Only students may create submissions here/);
    assert.match(src, /You are not enrolled in this cohort/);
    assert.match(src, /late \? 'late' : 'submitted'/);
    assert.match(src, /Cannot submit: a final grade already exists/);
    assert.match(src, /student_id: requester\.userId/);
  });

  it('updateSubmission encodes ownership and graded/final locks; sets resubmitted', () => {
    const src = readSrc('src', 'modules', 'submissions', 'submissions.service.js');
    assert.match(src, /row\.student_id !== requester\.userId/);
    assert.match(src, /Cannot modify submission after final grade/);
    assert.match(src, /Cannot modify graded submission/);
    assert.match(src, /status: 'resubmitted'/);
  });

  it('grade create/update/finalize encode staff write scope and score bounds', () => {
    const src = readSrc('src', 'modules', 'grades', 'grades.service.js');
    const lifecycle = readSrc('src', 'modules', 'grades', 'grades.lifecycle.js');
    assert.match(src, /assertStaffGrader/);
    assert.match(src, /Cannot grade without at least one submission/);
    assert.match(src, /assertGradeScoreInRange/);
    assert.match(lifecycle, /score must be between 0 and 100/);
    assert.match(src, /async function finalizeGrade/);
    assert.match(src, /is_final: true/);
    assert.match(src, /assertGradeMutable/);
  });

  it('unauthenticated write endpoints return 401', async () => {
    const cases = [
      ['post', `/api/v1/assessments/${ASSESSMENT_ID}/submissions`, { submission_type: 'text_response', text_response: 'x' }],
      ['put', `/api/v1/submissions/${SUBMISSION_ID}`, { text_response: 'x' }],
      ['post', `/api/v1/assessments/${ASSESSMENT_ID}/grades`, { student_id: STUDENT_ID, score: 50 }],
      ['put', `/api/v1/grades/${GRADE_ID}`, { score: 60 }],
      ['patch', `/api/v1/grades/${GRADE_ID}/finalize`, undefined],
    ];
    for (const [method, url, body] of cases) {
      const req = request(app)[method](url);
      const res = body === undefined ? await req : await req.send(body);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${url}`);
    }
  });

  it('field-training student routes remain separate from academic submissions module', () => {
    const academic = readSrc('src', 'modules', 'submissions', 'submissions.routes.js');
    const ft = readSrc('src', 'modules', 'fieldTraining', 'studentFieldTraining.routes.js');
    assert.equal(/field.?training/i.test(academic), false);
    assert.match(ft, /submit|assessments/i);
  });

  it('frontend services expose the five academic write client functions', () => {
    const feRoot = path.join(__dirname, '..', '..', 'frontend', 'src', 'features');
    const submissionsSrc = fs.readFileSync(path.join(feRoot, 'submissions', 'submissions.service.js'), 'utf8');
    const gradesSrc = fs.readFileSync(path.join(feRoot, 'grades', 'grades.service.js'), 'utf8');
    assert.match(submissionsSrc, /createAcademicSubmission/);
    assert.match(submissionsSrc, /updateAcademicSubmission/);
    assert.match(submissionsSrc, /apiClient\.post/);
    assert.match(submissionsSrc, /apiClient\.put/);
    assert.match(gradesSrc, /createAcademicGrade/);
    assert.match(gradesSrc, /updateAcademicGrade/);
    assert.match(gradesSrc, /finalizeAcademicGrade/);
    assert.match(gradesSrc, /apiClient\.patch/);
  });
});
