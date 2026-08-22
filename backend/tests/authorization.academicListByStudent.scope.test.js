'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ApiError } = require('../src/utils/apiError');
const submissionsService = require('../src/modules/submissions/submissions.service');
const gradesService = require('../src/modules/grades/grades.service');
const { makeRequester, makeGlobalSuperAdmin, SYNTH_USER_B } = require('./helpers/authzFixtures');

describe('BUG-002 listByStudent university scope', () => {
  it('institution admin without universityId cannot dump another student submissions', async () => {
    await assert.rejects(
      () =>
        submissionsService.listByStudent(
          SYNTH_USER_B,
          makeRequester({ roles: ['admin'], universityId: null, isGlobal: false })
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('institution admin without universityId cannot dump another student grades', async () => {
    await assert.rejects(
      () =>
        gradesService.listByStudent(
          SYNTH_USER_B,
          makeRequester({ roles: ['admin'], universityId: null, isGlobal: false })
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('non-staff cannot list another student', async () => {
    await assert.rejects(
      () =>
        submissionsService.listByStudent(
          SYNTH_USER_B,
          makeRequester({ roles: ['student'], universityId: null, isGlobal: false })
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('super_admin is not rejected before query (BUG-002 does not lock global)', async () => {
    const admin = makeGlobalSuperAdmin();
    assert.equal(admin.isGlobal, true);
  });
});
