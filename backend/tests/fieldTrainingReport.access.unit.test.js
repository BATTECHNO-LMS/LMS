'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { ApiError } = require('../src/utils/apiError');
const {
  assertStaffReportAccess,
  studentOwnsApplication,
  scopeUniversityId,
  withAcademicUniversity,
} = require('../src/modules/fieldTraining/fieldTrainingReport.service');
const {
  REPORT_ACTIONS,
  verifyUniversityFieldTrainingReportAccess,
  buildReportCapabilities,
} = require('../src/modules/fieldTraining/fieldTrainingReport.access');
const { exportUniversityReportExcel } = require('../src/modules/fieldTraining/fieldTrainingReport.excel');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  SYNTH_USER_B,
  makeRequester,
  makeGlobalSuperAdmin,
} = require('./helpers/authzFixtures');

function view(user, universityId) {
  return verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: universityId,
    action: REPORT_ACTIONS.VIEW_REPORT,
  });
}

function act(user, action, universityId) {
  return verifyUniversityFieldTrainingReportAccess({
    user,
    requestedUniversityId: universityId,
    action,
  });
}

describe('field training report access', () => {
  it('denies students from university comprehensive reports', () => {
    assert.throws(
      () => assertStaffReportAccess(makeRequester({ roles: ['student'], universityId: SYNTH_UNI_A })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies instructors from university comprehensive reports', () => {
    assert.throws(
      () => assertStaffReportAccess(makeRequester({ roles: ['instructor'], universityId: SYNTH_UNI_A })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies trainer and trainee from administrative reports', () => {
    assert.throws(
      () => assertStaffReportAccess(makeRequester({ roles: ['trainer'], universityId: SYNTH_UNI_A })),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'FIELD_TRAINING_FORBIDDEN'
    );
    assert.throws(
      () => assertStaffReportAccess(makeRequester({ roles: ['trainee'], universityId: SYNTH_UNI_A })),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('allows university admin, reviewer, and super-admin to staff reports', () => {
    assert.doesNotThrow(() =>
      assertStaffReportAccess(makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A }))
    );
    assert.doesNotThrow(() =>
      assertStaffReportAccess(makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A }))
    );
    assert.doesNotThrow(() => assertStaffReportAccess(makeGlobalSuperAdmin()));
  });

  it('reviewer can view and export own university but cannot generate or cross universities', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A, isGlobal: false });
    assert.equal(view(reviewer, SYNTH_UNI_A).capabilities.canViewUniversityReport, true);
    assert.equal(act(reviewer, REPORT_ACTIONS.EXPORT_REPORT, SYNTH_UNI_A).capabilities.canExportPdf, true);
    assert.equal(act(reviewer, REPORT_ACTIONS.VIEW_REPORT_HISTORY, SYNTH_UNI_A).capabilities.canViewHistory, true);
    assert.throws(
      () => act(reviewer, REPORT_ACTIONS.GENERATE_REPORT, SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'REPORT_READ_ONLY'
    );
    assert.throws(
      () => act(reviewer, REPORT_ACTIONS.REGENERATE_REPORT, SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.code === 'REPORT_READ_ONLY'
    );
    assert.throws(
      () => view(reviewer, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN'
    );
    assert.equal(buildReportCapabilities(reviewer).includeRawExcel, false);
    assert.equal(buildReportCapabilities(reviewer).canGenerate, false);
    assert.equal(buildReportCapabilities(reviewer).readOnly, true);
  });

  it('university admin can generate own university and cannot cross universities', () => {
    const admin = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A, isGlobal: false });
    assert.equal(act(admin, REPORT_ACTIONS.GENERATE_REPORT, SYNTH_UNI_A).capabilities.canGenerate, true);
    assert.equal(act(admin, REPORT_ACTIONS.REGENERATE_REPORT, SYNTH_UNI_A).capabilities.canRegenerate, true);
    assert.throws(
      () => view(admin, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.code === 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN'
    );
    assert.equal(buildReportCapabilities(admin).includeRawExcel, true);
    assert.equal(buildReportCapabilities(admin).canSelectUniversity, false);
  });

  it('does not treat admin with missing universityId as global', () => {
    const admin = makeRequester({ roles: ['admin'], universityId: null, isGlobal: false });
    assert.throws(
      () => assertStaffReportAccess(admin),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'UNIVERSITY_REQUIRED'
    );
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: null, isGlobal: false });
    assert.throws(
      () => assertStaffReportAccess(reviewer),
      (err) => err instanceof ApiError && err.code === 'UNIVERSITY_REQUIRED'
    );
  });

  it('denies institution admin from university field-training reports', () => {
    const institutionAdmin = makeRequester({
      roles: ['admin'],
      universityId: SYNTH_UNI_A,
      isGlobal: false,
      organizationType: 'INSTITUTION',
      portalType: 'INSTITUTION',
    });
    assert.throws(
      () => view(institutionAdmin, SYNTH_UNI_A),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'PORTAL_MISMATCH'
    );
  });

  it('super admin can view and generate any university', () => {
    const superAdmin = makeGlobalSuperAdmin();
    assert.equal(view(superAdmin, SYNTH_UNI_A).universityId, SYNTH_UNI_A);
    assert.equal(view(superAdmin, SYNTH_UNI_B).universityId, SYNTH_UNI_B);
    assert.equal(act(superAdmin, REPORT_ACTIONS.GENERATE_REPORT, SYNTH_UNI_B).capabilities.canGenerate, true);
    assert.equal(buildReportCapabilities(superAdmin).canSelectUniversity, true);
    assert.equal(buildReportCapabilities(superAdmin).includeRawExcel, true);
  });

  it('studentOwnsApplication is true only for the authenticated student', () => {
    const app = { student_id: SYNTH_USER_A };
    assert.equal(studentOwnsApplication(makeRequester({ userId: SYNTH_USER_A, roles: ['student'] }), app), true);
    assert.equal(studentOwnsApplication(makeRequester({ userId: SYNTH_USER_B, roles: ['student'] }), app), false);
  });

  it('scopes university reports to the caller university unless super-admin', () => {
    const admin = makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A, isGlobal: false });
    assert.throws(
      () => scopeUniversityId(admin, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    assert.equal(scopeUniversityId(admin, SYNTH_UNI_A), SYNTH_UNI_A);
    assert.equal(scopeUniversityId(makeGlobalSuperAdmin(), SYNTH_UNI_B), SYNTH_UNI_B);
  });

  it('academic reviewer cannot request another university via query override', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A, isGlobal: false });
    assert.throws(
      () => withAcademicUniversity(reviewer, { university_id: SYNTH_UNI_B }),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    const scoped = withAcademicUniversity(reviewer, {});
    assert.equal(scoped.university_id, SYNTH_UNI_A);
  });
});

describe('field training report Excel access variants', () => {
  it('omits the raw-data sheet for reviewer-safe workbooks', async () => {
    const buffer = await exportUniversityReportExcel(
      {
        report_title: 'تقرير',
        university: { name: 'جامعة أ', code: 'A' },
        summary: {},
        meta: {},
        students: [],
        opportunities: { rows: [] },
        organizations: { rows: [] },
        attendance: { by_specialty: [] },
        hours: {},
        tasks: {},
        assessments: {},
        progress: {},
        completion: {},
        certificates: {},
        instructors: [],
        risk: [],
        recommendations: [],
        data_quality_warnings: [],
      },
      { includeRawData: false }
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const names = wb.worksheets.map((ws) => ws.name);
    assert.equal(names.includes('16_البيانات_الخام'), false);
    assert.ok(names.includes('03_الطلاب'));
  });
});
