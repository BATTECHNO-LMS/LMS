'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('institution administration wiring', () => {
  it('keeps Organization as institution source of truth in public and admin services', () => {
    const servicePath = path.join(
      __dirname,
      '../src/modules/organizations/organizations.service.js'
    );
    const src = fs.readFileSync(servicePath, 'utf8');
    assert.match(src, /async function listPublicInstitutions/);
    assert.match(src, /async function listOrganizations/);
    assert.match(src, /type:\s*'INSTITUTION'/);
    assert.match(src, /allows_public_trainee_registration:\s*true/);
    // Public list filters by registration flag; admin list must not.
    const publicFn = src.slice(src.indexOf('async function listPublicInstitutions'));
    const adminFn = src.slice(
      src.indexOf('async function listOrganizations'),
      src.indexOf('async function listPublicInstitutions')
    );
    assert.match(publicFn, /allows_public_trainee_registration/);
    assert.equal(adminFn.includes('allows_public_trainee_registration'), false);
  });

  it('forces TRAINING_COURSE on program create and rejects client-supplied type', () => {
    const servicePath = path.join(
      __dirname,
      '../src/modules/trainingPrograms/trainingPrograms.service.js'
    );
    const validationPath = path.join(
      __dirname,
      '../src/modules/trainingPrograms/trainingPrograms.validation.js'
    );
    const service = fs.readFileSync(servicePath, 'utf8');
    const validation = fs.readFileSync(validationPath, 'utf8');
    assert.match(service, /type:\s*'TRAINING_COURSE'/);
    assert.match(service, /org\.type !== 'INSTITUTION'/);
    assert.match(validation, /type:\s*z\.undefined\(\)/);
    assert.match(validation, /\.strict\(\)/);
  });

  it('exposes GET /training/courses and program detail routes', () => {
    const routesPath = path.join(
      __dirname,
      '../src/modules/trainingPrograms/trainingPrograms.routes.js'
    );
    const src = fs.readFileSync(routesPath, 'utf8');
    assert.match(src, /'\/courses'/);
    assert.match(src, /'\/programs\/:programId'/);
    assert.match(src, /c\.listTrainingCourses/);
    assert.match(src, /c\.getProgram/);
  });

  it('progress engine includes required pre/post assessments', () => {
    const servicePath = path.join(
      __dirname,
      '../src/modules/trainingPrograms/trainingPrograms.service.js'
    );
    const helpersPath = path.join(
      __dirname,
      '../src/modules/trainingPrograms/trainingProgress.helpers.js'
    );
    const src = `${fs.readFileSync(servicePath, 'utf8')}\n${fs.readFileSync(helpersPath, 'utf8')}`;
    assert.match(src, /preTest:\s*assessmentOk\('PRE_TEST'\)/);
    assert.match(src, /postTest:\s*assessmentOk\('POST_TEST'\)/);
    assert.match(src, /buildProgressRequirements/);
  });
});
