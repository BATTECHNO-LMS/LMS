'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const {
  sanitizeNamePart,
  buildStudentReportPdfFilename,
  buildStudentReportsZipFilename,
  uniqueZipEntry,
  contentDispositionAttachment,
} = require('../src/modules/fieldTraining/fieldTraining.studentReportsBulk.filename');
const { buildStudentReportsZip } = require('../src/modules/fieldTraining/fieldTraining.studentReportsBulk.zip');
const bulk = require('../src/modules/fieldTraining/fieldTraining.studentReportsBulk.service');
const { ApiError } = require('../src/utils/apiError');
const {
  makeRequester,
  makeGlobalSuperAdmin,
  SYNTH_UNI_A,
  SYNTH_UNI_B,
} = require('./helpers/authzFixtures');

describe('field training bulk student report filenames', () => {
  it('sanitizes unsafe characters and builds human-readable PDF names', () => {
    assert.equal(sanitizeNamePart('a/b:c*d'), 'abcd');
    const name = buildStudentReportPdfFilename({
      index: 3,
      studentName: 'ليث محمد احمد بريوش',
      universityNumber: '320230601066',
    });
    assert.equal(name, '003-ليث-محمد-احمد-بريوش-320230601066.pdf');
    assert.doesNotMatch(name, /[<>:"/\\|?*]/);
  });

  it('builds a meaningful ZIP filename and content-disposition headers', () => {
    const zipName = buildStudentReportsZipFilename({
      opportunityTitle: 'تدريب الزرقاء 2026',
      date: '2026-09-22',
    });
    assert.match(zipName, /^eprojecto-field-training-student-reports-/);
    assert.match(zipName, /2026-09-22\.zip$/);
    const header = contentDispositionAttachment(zipName);
    assert.match(header, /attachment;/);
    assert.match(header, /filename\*=UTF-8''/);
  });

  it('keeps ZIP entries unique and blocks path traversal', () => {
    const used = new Set();
    const first = uniqueZipEntry(used, '../secret/a.pdf');
    const second = uniqueZipEntry(used, '../secret/a.pdf');
    assert.equal(first, 'secret/a.pdf');
    assert.equal(second, 'secret/a-2.pdf');
    assert.ok(!first.includes('..'));
  });
});

describe('field training bulk student report filters', () => {
  const participants = [
    {
      application_id: 'a1',
      student_name: 'أحمد محمد',
      university_student_number: '100',
      eligibility_status: 'eligible',
      training_status: 'completed',
    },
    {
      application_id: 'a2',
      student_name: 'سارة خالد',
      university_student_number: '200',
      eligibility_status: 'ineligible',
      training_status: 'failed',
    },
    {
      application_id: 'a3',
      student_name: 'ليث بريوش',
      university_student_number: '320230601066',
      eligibility_status: 'eligible',
      training_status: 'in_training',
    },
  ];

  it('filters by eligibility and search without using pagination', () => {
    const filtered = bulk.applyExportFilters(participants, {
      eligibility_status: 'eligible',
      search: 'ليث',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].application_id, 'a3');
  });

  it('sorts deterministically by Arabic name then university number', () => {
    const sorted = bulk.sortParticipants(participants);
    assert.deepEqual(
      sorted.map((row) => row.application_id),
      ['a1', 'a2', 'a3']
    );
  });
});

describe('field training bulk student report ZIP builder', () => {
  it('packs valid PDFs, rejects non-PDFs, and writes EXPORT_ERRORS.txt', async () => {
    const pdf = Buffer.from('%PDF-1.4 demo');
    const built = await buildStudentReportsZip(
      [
        {
          applicationId: 'ok',
          studentName: 'أحمد',
          universityNumber: '111',
          filename: '001-أحمد-111.pdf',
        },
        {
          applicationId: 'bad',
          studentName: 'سارة',
          universityNumber: '222',
          filename: '002-سارة-222.pdf',
        },
        {
          applicationId: 'dup',
          studentName: 'أحمد',
          universityNumber: '111',
          filename: '001-أحمد-111.pdf',
        },
      ],
      {
        concurrency: 2,
        onFile: async (entry) => {
          if (entry.applicationId === 'bad') return Buffer.from('not-a-pdf');
          return pdf;
        },
      }
    );

    assert.equal(built.selected, 3);
    assert.equal(built.included.length, 2);
    assert.equal(built.failed.length, 1);

    const chunks = [];
    await new Promise((resolve, reject) => {
      built.stream.on('data', (chunk) => chunks.push(chunk));
      built.stream.on('error', reject);
      built.stream.on('end', resolve);
    });
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    assert.ok(names.includes('001-أحمد-111.pdf'));
    assert.ok(names.includes('001-أحمد-111-2.pdf'));
    assert.ok(names.includes('EXPORT_ERRORS.txt'));
    assert.ok(!names.includes('002-سارة-222.pdf'));
  });
});

describe('field training bulk student report service auth gates', () => {
  beforeEach(() => {
    bulk.__resetJobsForTests();
  });

  it('requires manage access through listOpportunityEligibility and blocks empty exports', async () => {
    const original = require('../src/modules/fieldTraining/fieldTraining.service').listOpportunityEligibility;
    require('../src/modules/fieldTraining/fieldTraining.service').listOpportunityEligibility = async () => ({
      opportunity: { id: 'opp-1', title: 'فرصة تجريبية' },
      participants: [],
    });
    try {
      await assert.rejects(
        () =>
          bulk.startBulkStudentReports('opp-1', makeGlobalSuperAdmin(), {
            sync: true,
          }),
        (err) => err instanceof ApiError && err.code === 'STUDENT_REPORTS_BULK_EMPTY'
      );
    } finally {
      require('../src/modules/fieldTraining/fieldTraining.service').listOpportunityEligibility = original;
    }
  });

  it('keeps university admin requester identity in the job snapshot', async () => {
    const uniAdmin = makeRequester({
      userId: 'admin-a',
      roles: ['admin'],
      universityId: SYNTH_UNI_A,
      organizationType: 'UNIVERSITY',
      portalType: 'UNIVERSITY',
    });
    const other = makeRequester({
      userId: 'admin-b',
      roles: ['admin'],
      universityId: SYNTH_UNI_B,
      organizationType: 'UNIVERSITY',
      portalType: 'UNIVERSITY',
    });

    const service = require('../src/modules/fieldTraining/fieldTraining.service');
    const original = service.listOpportunityEligibility;
    service.listOpportunityEligibility = async (_id, user) => {
      if (String(user.universityId) !== String(SYNTH_UNI_A)) {
        throw new ApiError(403, 'forbidden', null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
      }
      return {
        opportunity: { id: 'opp-1', title: 'Zarqa' },
        participants: [
          {
            application_id: '11111111-1111-1111-1111-111111111111',
            student_name: 'طالب',
            university_student_number: '1',
            eligibility_status: 'eligible',
          },
        ],
      };
    };

    const access = require('../src/modules/fieldTraining/fieldTraining.access');
    const originalAssert = access.assertManageOpportunityAccess;
    access.assertManageOpportunityAccess = async () => undefined;

    const comprehensive = require('../src/modules/fieldTraining/fieldTraining.comprehensiveReport.service');
    const originalExport = comprehensive.exportComprehensiveStudentReportPdf;
    comprehensive.exportComprehensiveStudentReportPdf = async () => ({
      buffer: Buffer.from('%PDF-1.4 ok'),
      filename: 'x.pdf',
    });

    const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
    const originalFind = repo.findById;
    repo.findById = async () => ({ id: 'opp-1', title: 'Zarqa', university_id: SYNTH_UNI_A });

    const { prisma } = require('../src/config/db');
    const originalSessions = prisma.field_training_sessions.findMany;
    const originalTasks = prisma.field_training_tasks.findMany;
    const originalApps = prisma.field_training_applications.findMany;
    prisma.field_training_sessions.findMany = async () => [];
    prisma.field_training_tasks.findMany = async () => [];
    prisma.field_training_applications.findMany = async () => [
      { id: '11111111-1111-1111-1111-111111111111', opportunity_id: 'opp-1', student_id: 's1' },
    ];

    try {
      await assert.rejects(
        () => bulk.previewBulkStudentReports('opp-1', other, {}),
        (err) => err instanceof ApiError && err.code === 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN'
      );

      const preview = await bulk.previewBulkStudentReports('opp-1', uniAdmin, {
        eligibility_status: 'eligible',
      });
      assert.equal(preview.matching_count, 1);

      const job = await bulk.startBulkStudentReports('opp-1', uniAdmin, {
        eligibility_status: 'eligible',
        sync: true,
      });
      assert.equal(job.status, 'ready');
      assert.equal(job.progress.included, 1);
      assert.equal(job.created_by_id || job.progress.total, 1);

      await assert.rejects(
        () => bulk.getBulkStudentReportsJob('opp-1', job.id, other),
        (err) => err instanceof ApiError && err.statusCode === 403
      );

      await assert.rejects(
        () => bulk.downloadBulkStudentReportsZip('opp-1', job.id, other),
        (err) => err instanceof ApiError && err.statusCode === 403
      );

      const file = await bulk.downloadBulkStudentReportsZip('opp-1', job.id, uniAdmin);
      assert.ok(file.absPath.includes(`${require('path').sep}private${require('path').sep}`));
      assert.match(file.contentType, /zip/i);
      assert.match(file.contentDisposition, /attachment;/);
    } finally {
      service.listOpportunityEligibility = original;
      access.assertManageOpportunityAccess = originalAssert;
      comprehensive.exportComprehensiveStudentReportPdf = originalExport;
      repo.findById = originalFind;
      prisma.field_training_sessions.findMany = originalSessions;
      prisma.field_training_tasks.findMany = originalTasks;
      prisma.field_training_applications.findMany = originalApps;
    }
  });
});
