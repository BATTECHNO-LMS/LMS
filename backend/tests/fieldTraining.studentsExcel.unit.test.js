'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { ApiError } = require('../src/utils/apiError');
const { extractUniversityNumberFromEmail } = require('../src/modules/fieldTraining/universityNumberFromEmail');
const {
  SHEET_NAME,
  COLUMN_HEADERS,
  SUPERVISOR_COL,
  UNIVERSITY_NUMBER_COL,
  mapStudentExcelRow,
  exportFieldTrainingStudentsExcel,
} = require('../src/modules/fieldTraining/fieldTrainingStudentsExcel');
const {
  resolveStudentsExcelScope,
  applyStudentExcelFilters,
  buildExcelSource,
} = require('../src/modules/fieldTraining/fieldTrainingStudentsExport.service');
const {
  REPORT_ACTIONS,
  verifyUniversityFieldTrainingReportAccess,
} = require('../src/modules/fieldTraining/fieldTrainingReport.access');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  makeRequester,
  makeGlobalSuperAdmin,
} = require('./helpers/authzFixtures');

const STUDENT_UUID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const APP_A = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';
const APP_B = 'cccccccc-1111-4111-8111-cccccccccccc';
const OPP_A = 'dddddddd-1111-4111-8111-dddddddddddd';
const OPP_B = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee';

function source(overrides = {}) {
  return {
    student_name: 'طالب تجريبي',
    student_email: '202312345@university.edu.jo',
    student_id: STUDENT_UUID,
    specialty_label: 'هندسة',
    university_name: 'جامعة الاختبار',
    opportunity_title: 'فرصة أ',
    training_organization: 'جهة التدريب',
    application_status: 'pending',
    training_status: 'none',
    eligibility_status: 'pending',
    final_evaluation_status: null,
    submitted_at: '2026-03-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('universityNumberFromEmail', () => {
  it('extracts the local-part before the first @', () => {
    assert.equal(extractUniversityNumberFromEmail('202312345@university.edu.jo'), '202312345');
    assert.equal(extractUniversityNumberFromEmail('student.name@university.edu'), 'student.name');
  });

  it('preserves leading zeros in the local-part', () => {
    assert.equal(extractUniversityNumberFromEmail('01234567@university.edu.jo'), '01234567');
  });

  it('returns blank for missing or invalid emails without @', () => {
    assert.equal(extractUniversityNumberFromEmail(null), '');
    assert.equal(extractUniversityNumberFromEmail(''), '');
    assert.equal(extractUniversityNumberFromEmail('   '), '');
    assert.equal(extractUniversityNumberFromEmail('not-an-email'), '');
    assert.equal(extractUniversityNumberFromEmail(STUDENT_UUID), '');
  });

  it('never uses a user UUID as a fallback', () => {
    const row = mapStudentExcelRow(
      source({ student_email: null, student_id: STUDENT_UUID }),
      0
    );
    assert.equal(row.universityNumber, '');
    assert.notEqual(row.universityNumber, STUDENT_UUID);
  });
});

describe('field training students excel mapping', () => {
  it('keeps المشرف الأكاديمي blank on every row', () => {
    const rows = [
      mapStudentExcelRow(source({ instructor_id: SYNTH_USER_A }), 0),
      mapStudentExcelRow(source({ application_status: 'approved', training_status: 'completed' }), 1),
    ];
    for (const row of rows) {
      assert.equal(row.academicSupervisor, '');
    }
  });

  it('does not copy instructor or opportunity supervisor into the supervisor column', () => {
    const mapped = buildExcelSource({
      app: {
        id: APP_A,
        student_id: STUDENT_UUID,
        status: 'approved',
        training_status: 'in_training',
        completion_eligibility_status: 'pending',
        created_at: new Date('2026-01-01'),
      },
      profile: { full_name: 'طالب', email: '202312345@university.edu.jo' },
      opportunity: {
        title: 'فرصة',
        organization_name: 'جهة',
        assigned_instructor_id: SYNTH_USER_A,
      },
      finalStatus: null,
    });
    const row = mapStudentExcelRow(mapped, 0);
    assert.equal(row.academicSupervisor, '');
    assert.equal(mapped.instructor_id, SYNTH_USER_A);
  });

  it('maps application, training, eligibility, final evaluation, and task progress labels', () => {
    const pending = mapStudentExcelRow(source({ application_status: 'pending' }), 0);
    const approved = mapStudentExcelRow(source({ application_status: 'approved' }), 0);
    const rejected = mapStudentExcelRow(source({ application_status: 'rejected' }), 0);
    const cancelled = mapStudentExcelRow(source({ application_status: 'cancelled' }), 0);
    const completed = mapStudentExcelRow(source({ training_status: 'completed' }), 0);
    const failedTraining = mapStudentExcelRow(source({ training_status: 'failed' }), 0);
    const expelled = mapStudentExcelRow(source({ training_status: 'expelled' }), 0);
    const failedEval = mapStudentExcelRow(source({ final_evaluation_status: 'FAILED' }), 0);
    const notEligible = mapStudentExcelRow(source({ final_evaluation_status: 'NOT_ELIGIBLE' }), 0);
    const missingEval = mapStudentExcelRow(source({ final_evaluation_status: null }), 0);
    const tasksDone = mapStudentExcelRow(
      source({
        application_status: 'approved',
        task_progress: { display: '8 / 8 — أكمل المهمات', status: 'completed' },
      }),
      0
    );

    assert.equal(pending.applicationStatus, 'قيد المراجعة');
    assert.equal(approved.applicationStatus, 'مقبول');
    assert.equal(rejected.applicationStatus, 'مرفوض');
    assert.equal(cancelled.applicationStatus, 'ملغى');
    assert.equal(completed.trainingStatus, 'مكتمل');
    assert.equal(failedTraining.trainingStatus, 'غير مكتمل');
    assert.equal(expelled.trainingStatus, 'مستبعد');
    assert.equal(failedEval.finalResult, 'راسب');
    assert.equal(notEligible.finalResult, 'غير مؤهل');
    assert.equal(missingEval.finalResult, '');
    assert.equal(tasksDone.taskProgress, '8 / 8 — أكمل المهمات');
  });

  it('keeps different opportunities for the same student as separate rows', () => {
    const rows = [
      mapStudentExcelRow(source({ opportunity_title: 'فرصة أ', application_id: APP_A }), 0),
      mapStudentExcelRow(source({ opportunity_title: 'فرصة ب', application_id: APP_B }), 1),
    ];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].opportunity, 'فرصة أ');
    assert.equal(rows[1].opportunity, 'فرصة ب');
    assert.notEqual(rows[0].seq, rows[1].seq);
  });

  it('exports every matching filtered row rather than a page slice', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      application_id: `row-${i}`,
      student_name: `طالب ${i}`,
      student_email: `2023${String(i).padStart(5, '0')}@university.edu.jo`,
      eligibility_status: 'pending',
    }));
    const filtered = applyStudentExcelFilters(rows, {});
    assert.equal(filtered.length, 25);
  });
});

describe('field training students excel workbook', () => {
  it('writes an RTL worksheet with blank supervisor and text university numbers', async () => {
    const file = await exportFieldTrainingStudentsExcel([
      source({ student_email: '01234567@university.edu.jo', instructor_id: SYNTH_USER_A }),
      source({
        student_email: '202312345@university.edu.jo',
        opportunity_title: 'فرصة ب',
        final_evaluation_status: 'FAILED',
      }),
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    const ws = wb.getWorksheet(SHEET_NAME);
    assert.ok(ws);
    assert.equal(ws.name, 'طلاب التدريب الميداني');
    assert.deepEqual(
      ws.getRow(1).values.slice(1),
      [...COLUMN_HEADERS]
    );
    assert.equal(ws.getRow(2).getCell(SUPERVISOR_COL).value, '');
    assert.equal(ws.getRow(3).getCell(SUPERVISOR_COL).value, '');
    const uniCell = ws.getRow(2).getCell(UNIVERSITY_NUMBER_COL);
    assert.equal(String(uniCell.value), '01234567');
    assert.equal(uniCell.numFmt, '@');
    assert.equal(ws.getRow(3).getCell(16).value, 'راسب');
    assert.equal(ws.views?.[0]?.rightToLeft, true);
    assert.equal(file.rowCount, 2);
  });

  it('writes تقدم المهمات with the Arabic submitted/total status', async () => {
    const file = await exportFieldTrainingStudentsExcel([
      source({
        application_status: 'approved',
        task_progress: { display: '8 / 8 — أكمل المهمات', status: 'completed' },
      }),
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    const ws = wb.getWorksheet(SHEET_NAME);
    assert.equal(ws.getRow(1).getCell(12).value, 'تقدم المهمات');
    assert.equal(ws.getRow(2).getCell(12).value, '8 / 8 — أكمل المهمات');
  });
});

describe('field training students excel access', () => {
  it('allows super_admin, university admin, and reviewer to export within scope', () => {
    assert.doesNotThrow(() => resolveStudentsExcelScope(makeGlobalSuperAdmin(), SYNTH_UNI_A));
    assert.doesNotThrow(() =>
      resolveStudentsExcelScope(makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A }), SYNTH_UNI_A)
    );
    assert.doesNotThrow(() =>
      resolveStudentsExcelScope(makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A }), SYNTH_UNI_A)
    );
  });

  it('keeps reviewer export read-only and university-scoped', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => resolveStudentsExcelScope(reviewer, SYNTH_UNI_A));
    assert.throws(
      () =>
        verifyUniversityFieldTrainingReportAccess({
          user: reviewer,
          requestedUniversityId: SYNTH_UNI_A,
          action: REPORT_ACTIONS.GENERATE_REPORT,
        }),
      (err) => err instanceof ApiError && err.code === 'REPORT_READ_ONLY'
    );
    assert.throws(
      () => resolveStudentsExcelScope(reviewer, SYNTH_UNI_B),
      (err) => err instanceof ApiError && err.code === 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN'
    );
  });

  it('prevents a university admin from exporting another university', () => {
    assert.throws(
      () =>
        resolveStudentsExcelScope(
          makeRequester({ roles: ['admin'], universityId: SYNTH_UNI_A }),
          SYNTH_UNI_B
        ),
      (err) => err instanceof ApiError && err.code === 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN'
    );
  });

  it('denies instructor, student, trainer, trainee, and institution roles from university-wide export', () => {
    const denied = [
      makeRequester({ roles: ['instructor'], universityId: SYNTH_UNI_A }),
      makeRequester({ roles: ['student'], universityId: SYNTH_UNI_A }),
      makeRequester({ roles: ['trainer'], universityId: SYNTH_UNI_A }),
      makeRequester({ roles: ['trainee'], universityId: SYNTH_UNI_A }),
      makeRequester({
        roles: ['admin'],
        universityId: SYNTH_UNI_A,
        portalType: 'INSTITUTION',
        organizationType: 'INSTITUTION',
      }),
    ];
    for (const user of denied) {
      assert.throws(
        () => resolveStudentsExcelScope(user, SYNTH_UNI_A),
        (err) =>
          err instanceof ApiError &&
          (err.code === 'FIELD_TRAINING_FORBIDDEN' || err.code === 'PORTAL_MISMATCH')
      );
    }
  });
});

describe('field training students excel query shape', () => {
  it('does not paginate the export query', () => {
    const src = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingStudentsExport.service.js'),
      'utf8'
    );
    assert.doesNotMatch(src, /\bskip\s*:/);
    assert.doesNotMatch(src, /\btake\s*:/);
    assert.doesNotMatch(src, /page_size/);
  });
});
