'use strict';

/**
 * ISS-002 characterization (database-free): academic submissions/grades API surface
 * vs SPA read-only services. Does not change product behavior.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createSubmissionBodySchema,
  updateSubmissionBodySchema,
} = require('../src/modules/submissions/submissions.validation');
const {
  createGradeBodySchema,
  updateGradeBodySchema,
} = require('../src/modules/grades/grades.validation');

const assessmentsRoutes = require('../src/modules/assessments/assessments.routes');
const submissionsRoutes = require('../src/modules/submissions/submissions.routes');
const gradesRoutes = require('../src/modules/grades/grades.routes');

function collectRouteLayer(layer, prefix, out) {
  if (layer.route) {
    const routePath = prefix + (layer.route.path || '');
    for (const method of Object.keys(layer.route.methods || {})) {
      if (layer.route.methods[method]) out.push({ method: method.toUpperCase(), path: routePath });
    }
    return;
  }
  if (layer.name === 'router' && layer.handle?.stack) {
    const mount = layer.regexp?.source
      ? // express mount paths are hard to parse from regexp; keep relative
        ''
      : '';
    for (const child of layer.handle.stack) {
      collectRouteLayer(child, prefix + mount, out);
    }
  }
}

function listRouterPaths(router) {
  const out = [];
  for (const layer of router.stack || []) {
    collectRouteLayer(layer, '', out);
  }
  return out;
}

describe('ISS-002 academic submissions/grades characterization', () => {
  it('write validators accept the documented academic submission contract', () => {
    const create = createSubmissionBodySchema.safeParse({
      submission_type: 'text_response',
      text_response: 'answer',
    });
    assert.equal(create.success, true);

    const update = updateSubmissionBodySchema.safeParse({
      file_url: 'https://example.com/file.pdf',
    });
    assert.equal(update.success, true);

    const emptyUpdate = updateSubmissionBodySchema.safeParse({});
    assert.equal(emptyUpdate.success, false);
  });

  it('write validators accept the documented academic grade contract', () => {
    const create = createGradeBodySchema.safeParse({
      student_id: '11111111-1111-4111-8111-111111111111',
      score: 85,
      feedback: 'Good work',
      is_final: false,
    });
    assert.equal(create.success, true);

    const update = updateGradeBodySchema.safeParse({ score: 90, is_final: true });
    assert.equal(update.success, true);

    const badScore = createGradeBodySchema.safeParse({
      student_id: '11111111-1111-4111-8111-111111111111',
      score: 101,
    });
    assert.equal(badScore.success, false);
  });

  it('academic routers expose submission and grade write routes', () => {
    const assessmentPaths = listRouterPaths(assessmentsRoutes);
    const submissionPaths = listRouterPaths(submissionsRoutes);
    const gradePaths = listRouterPaths(gradesRoutes);

    assert.ok(
      assessmentPaths.some((r) => r.method === 'POST' && String(r.path).includes('submissions')),
      'POST .../submissions expected on assessments router'
    );
    assert.ok(
      assessmentPaths.some((r) => r.method === 'POST' && String(r.path).includes('grades')),
      'POST .../grades expected on assessments router'
    );
    assert.ok(
      submissionPaths.some((r) => r.method === 'PUT'),
      'PUT /submissions/:id expected'
    );
    assert.ok(
      gradePaths.some((r) => r.method === 'PUT'),
      'PUT /grades/:id expected'
    );
    assert.ok(
      gradePaths.some((r) => r.method === 'PATCH' && String(r.path).includes('finalize')),
      'PATCH /grades/:id/finalize expected'
    );
  });

  it('frontend academic submissions/grades services expose write clients for ISS-002 remediation', () => {
    const feRoot = path.join(__dirname, '..', '..', 'frontend', 'src', 'features');
    const submissionsSrc = fs.readFileSync(
      path.join(feRoot, 'submissions', 'submissions.service.js'),
      'utf8'
    );
    const gradesSrc = fs.readFileSync(path.join(feRoot, 'grades', 'grades.service.js'), 'utf8');

    assert.match(submissionsSrc, /apiClient\.get/);
    assert.match(submissionsSrc, /createAcademicSubmission/);
    assert.match(submissionsSrc, /updateAcademicSubmission/);
    assert.match(submissionsSrc, /apiClient\.post/);
    assert.match(submissionsSrc, /apiClient\.put/);

    assert.match(gradesSrc, /apiClient\.get/);
    assert.match(gradesSrc, /createAcademicGrade/);
    assert.match(gradesSrc, /updateAcademicGrade/);
    assert.match(gradesSrc, /finalizeAcademicGrade/);
    assert.match(gradesSrc, /apiClient\.patch/);
  });

  it('field-training write paths are a separate module surface from academic submissions', () => {
    const ftRoutesPath = path.join(
      __dirname,
      '..',
      'src',
      'modules',
      'fieldTraining',
      'studentFieldTraining.routes.js'
    );
    assert.equal(fs.existsSync(ftRoutesPath), true);
    const ftSrc = fs.readFileSync(ftRoutesPath, 'utf8');
    assert.match(ftSrc, /submit|ai-self-evaluate|assessments/i);
    // Academic submissions router must not mount FT paths
    const academicSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'submissions', 'submissions.routes.js'),
      'utf8'
    );
    assert.equal(/field.?training/i.test(academicSrc), false);
  });
});
