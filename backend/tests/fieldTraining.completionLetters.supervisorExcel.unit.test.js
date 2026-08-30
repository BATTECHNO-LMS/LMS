'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const JSZip = require('jszip');
const {
  parseSupervisorAssignmentWorkbook,
  summarizeParse,
  normalizePersonLabel,
  groupRowsBySupervisor,
} = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const { resolveSupervisorAccount, majorityId, matchUniversityByOpportunityTitle, matchExcelRow } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.service');
const names = require('../src/modules/fieldTraining/fieldTraining.supervisorName');
const zipUtil = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const {
  buildCompletionLetterPdfFilename,
  buildCompletionLettersZipFilename,
  contentDispositionAttachment,
} = require('../src/modules/fieldTraining/fieldTraining.completionLetter.filename');
const {
  SIGNATORY_NAME,
  SIGNATORY_TITLE,
  FONT_FAMILY,
  MIN_COMPLETION_LETTER_HOURS,
  computeLetterSourceHash,
  buildOfficialCompletionLetterHtml,
  loadLogoDataUri,
  loadStampDataUri,
  loadFontFaceCss,
} = require('../src/modules/fieldTraining/fieldTraining.completionLetter.template');
const { classifyStudent } = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { buildCompletionLettersZip } = require('../src/modules/fieldTraining/fieldTraining.completionLetter.zip');
const supervisorScope = require('../src/modules/fieldTraining/fieldTraining.supervisorScope');
const { ApiError } = require('../src/utils/apiError');
const {
  SYNTH_UNI_A,
  SYNTH_USER_A,
  SYNTH_USER_B,
  makeRequester,
  makeGlobalSuperAdmin,
} = require('./helpers/authzFixtures');

const FIXTURE = path.join(__dirname, 'fixtures', 'mutah-field-training-supervisor-assignments.xlsx');

const EXPECTED_GROUPS = {
  'زكريا الطراونه': 20,
  'د. خالد الطراونة': 13,
  'د.احمد الطراونة': 13,
  'أ.د. عوني حموري': 10,
  'أ.د. مصطفى حماد': 10,
  'ربا الصعوب': 7,
  'د. رأفت المسيعدين': 6,
  'وفاء الطراونة': 4,
  'د. اسماء النوايسة': 3,
  'د. نديم العضايلة': 3,
  'د.المعتز المبيضين': 3,
  'د. معاذ الحجايا': 2,
  'أ.د بسام المحادين': 1,
  'أ.د. احمد الحسنات': 1,
  'د.انس الكساسبة': 1,
  'عمر اللصاصمه': 1,
};

describe('mutah supervisor excel fixture', () => {
  it('parses 98 students and 16 distinct supervisor groups without merging الطراونة names', async () => {
    const parsed = await parseSupervisorAssignmentWorkbook(FIXTURE);
    assert.equal(parsed.error, null);
    const summary = summarizeParse(parsed.rows);
    assert.equal(summary.totalRows, 98);
    assert.equal(summary.distinctSupervisors, 16);
    assert.equal(summary.missingUniversityNumbers, 0);
    assert.equal(summary.missingEmails, 0);
    assert.equal(summary.missingSupervisors, 0);
    assert.equal(summary.duplicateUniversityNumbers, 0);
    assert.equal(summary.duplicateEmails, 0);
    assert.deepEqual(summary.universities, ['جامعة مؤتة']);
    assert.deepEqual(summary.opportunities, ['التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026']);

    const counts = Object.fromEntries(summary.groups.map((g) => [g.supervisorLabel, g.rows.length]));
    assert.deepEqual(counts, EXPECTED_GROUPS);
    assert.notEqual(normalizePersonLabel('د. خالد الطراونة'), normalizePersonLabel('د.احمد الطراونة'));
    assert.notEqual(normalizePersonLabel('زكريا الطراونه'), normalizePersonLabel('وفاء الطراونة'));
  });

  it('preserves university numbers as identifier strings without scientific notation', async () => {
    const parsed = await parseSupervisorAssignmentWorkbook(FIXTURE);
    for (const row of parsed.rows) {
      assert.match(String(row.universityNumber), /^\d{10,14}$/);
      assert.equal(String(row.universityNumber).includes('e'), false);
      assert.equal(String(row.universityNumber).includes('.'), false);
    }
  });

  it('rejects duplicate university numbers and conflicting supervisor assignments', () => {
    const rows = [
      { excelRow: 2, universityNumber: '12001', universityEmail: 'a@mutah.edu.jo', supervisorName: 'أ', supervisorNormalized: 'أ', studentName: 'طالب' },
      { excelRow: 3, universityNumber: '12001', universityEmail: 'b@mutah.edu.jo', supervisorName: 'ب', supervisorNormalized: 'ب', studentName: 'طالب' },
    ];
    const summary = summarizeParse(rows);
    assert.ok(summary.duplicateUniversityNumbers >= 2);
    assert.ok(summary.conflictingAssignments >= 2);
  });
});

describe('plain-text academic supervisor names', () => {
  it('does not require a supervisor platform account', () => {
    const unique = resolveSupervisorAccount({
      group: { supervisorLabel: 'زكريا الطراونه', supervisorNormalized: 'زكريا الطراونه', rows: [] },
      reviewers: [],
      mappings: new Map(),
    });
    assert.equal(unique.status, 'unlinked');
    assert.equal(unique.account, null);
  });
  it('normalizes periods without merging different الطراونة people', () => {
    assert.equal(names.normalizeSupervisorKey('د . خالد الطراونة'), names.normalizeSupervisorKey('د. خالد الطراونة'));
    assert.notEqual(names.normalizeSupervisorKey('د. خالد الطراونة'), names.normalizeSupervisorKey('د.احمد الطراونة'));
    assert.notEqual(names.normalizeSupervisorKey('زكريا الطراونه'), names.normalizeSupervisorKey('وفاء الطراونة'));
  });

  it('keeps unassigned students in مشرف غير محدد', () => {
    const grouped = names.groupRowsBySupervisorName(
      [
        { academic_supervisor_name: 'زكريا الطراونه' },
        { academic_supervisor_name: '' },
        { academic_supervisor_name: null },
      ],
      (row) => row.academic_supervisor_name
    );
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].supervisor_label, 'زكريا الطراونه');
    assert.equal(grouped[1].supervisor_label, names.UNASSIGNED_SUPERVISOR_LABEL);
    assert.equal(grouped[1].students.length, 2);
  });

  it('builds supervisor ZIP folders and تقرير_التقييم filenames', async () => {
    const built = await zipUtil.buildReportsZip(
      [
        {
          studentName: 'أحمد عودةالله سالم الرماضين',
          universityNumber: '120232221002',
          supervisorFolder: names.sanitizeZipFolder('زكريا الطراونه'),
          filename: names.buildSupervisorReportPdfFilename({
            studentName: 'أحمد عودةالله سالم الرماضين',
            universityNumber: '120232221002',
          }),
          buffer: Buffer.from('%PDF-1.4 A'),
        },
        {
          studentName: 'وفاء رمضان خلف الجعافرة',
          universityNumber: '120232211066',
          supervisorFolder: names.sanitizeZipFolder('زكريا الطراونه'),
          filename: names.buildSupervisorReportPdfFilename({
            studentName: 'وفاء رمضان خلف الجعافرة',
            universityNumber: '120232211066',
          }),
          buffer: Buffer.from('%PDF-1.4 B'),
        },
      ],
      { mixedFolders: true, folderFor: (entry) => entry.supervisorFolder }
    );
    assert.equal(built.included.length, 2);
    assert.ok(built.included[0].zipPath.startsWith('زكريا الطراونه/'));
    assert.match(built.included[0].zipPath, /تقرير_التقييم\.pdf$/);
    assert.equal(names.buildSupervisorReportsZipFilename('زكريا الطراونه'), 'تقارير_زكريا_الطراونه.zip');
  });

  it('places every Mutah Excel student under the exact supervisor folder in both report and letter ZIPs', async () => {
    const parsed = await parseSupervisorAssignmentWorkbook(FIXTURE);
    const reportEntries = parsed.rows.map((row) => ({
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      supervisorFolder: names.sanitizeZipFolder(row.supervisorLabel),
      filename: names.buildSupervisorReportPdfFilename({
        studentName: row.studentName,
        universityNumber: row.universityNumber,
      }),
      buffer: Buffer.from(`%PDF-1.4 report ${row.universityNumber}`),
    }));
    const reports = await zipUtil.buildReportsZip(reportEntries, {
      mixedFolders: true,
      folderFor: (entry) => entry.supervisorFolder,
    });
    const reportZip = await JSZip.loadAsync(reports.buffer);
    const reportPdfs = Object.keys(reportZip.files).filter((name) => name.endsWith('.pdf'));
    assert.equal(reportPdfs.length, 98);
    assert.equal(new Set(reportPdfs.map((name) => name.split('/')[0])).size, 16);

    const letterEntries = parsed.rows.map((row) => ({
      applicationId: row.universityNumber,
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      supervisorFolder: names.sanitizeZipFolder(row.supervisorLabel),
      buffer: Buffer.from(`%PDF-1.4 letter ${row.universityNumber}`),
    }));
    const { stream, included } = await buildCompletionLettersZip(letterEntries);
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    const letterZip = await JSZip.loadAsync(Buffer.concat(chunks));
    const letterPdfs = Object.keys(letterZip.files).filter((name) => name.endsWith('.pdf'));
    assert.equal(included.length, 98);
    assert.equal(letterPdfs.length, 98);
    assert.equal(new Set(letterPdfs.map((name) => name.split('/')[0])).size, 16);

    for (const row of parsed.rows) {
      const folder = names.sanitizeZipFolder(row.supervisorLabel);
      const reportName = names.buildSupervisorReportPdfFilename({
        studentName: row.studentName,
        universityNumber: row.universityNumber,
      });
      const letterName = buildCompletionLetterPdfFilename({
        studentName: row.studentName,
        universityNumber: row.universityNumber,
      });
      assert.ok(reportZip.files[`${folder}/${reportName}`], `${folder}/${reportName}`);
      assert.ok(letterZip.files[`${folder}/${letterName}`], `${folder}/${letterName}`);
      assert.match(reportName, new RegExp(`${row.universityNumber}_تقرير_التقييم\\.pdf$`));
      assert.match(letterName, new RegExp(`${row.universityNumber}_كتاب_إنهاء_التدريب\\.pdf$`));
    }
  });

  it('picks a unique majority id and ignores ties', () => {
    assert.equal(majorityId(['a', 'a', 'b']), 'a');
    assert.equal(majorityId(['a', 'b']), null);
    assert.equal(majorityId([null, undefined, '']), null);
  });

  it('matches جامعة مؤتة from the opportunity title without colliding with TTU', () => {
    const universities = [
      { id: 'mutah', name: 'جامعة مؤتة' },
      { id: 'ttu', name: 'جامعة الطفيلة التقنية' },
    ];
    const mutah = matchUniversityByOpportunityTitle(
      'التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026',
      universities
    );
    assert.equal(mutah.id, 'mutah');
    const ttu = matchUniversityByOpportunityTitle(
      'التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026',
      universities
    );
    assert.equal(ttu.id, 'ttu');
  });
});

describe('supervisor excel live eligibility overlay', () => {
  it('replaces stale Excel eligibility with the live application status', () => {
    const row = {
      universityNumber: '120232221002',
      universityEmail: '120232221002@mutah.edu.jo',
      eligibilityStatus: 'غير مؤهل',
      trainingStatus: 'تم تسليم المهام',
      applicationStatus: 'مقبول',
      errors: [],
    };
    const record = {
      application: {
        id: 'app-1',
        opportunity_id: 'opp-1',
        status: 'approved',
        training_status: 'eligible_for_completion',
        completion_eligibility_status: 'eligible',
      },
      profile: { primary_university_id: 'uni-1', email: '120232221002@mutah.edu.jo' },
      email: '120232221002@mutah.edu.jo',
      assignment: null,
    };
    const matched = matchExcelRow(row, { byNumber: new Map([['120232221002', record]]), byEmail: new Map() }, {
      opportunity: { id: 'opp-1' },
      university: { id: 'uni-1' },
    });
    assert.equal(matched.eligibilityStatus, 'مؤهل');
    assert.equal(matched.trainingStatus, 'مؤهل للإنهاء');
    assert.equal(matched.applicationStatus, 'مقبول');
  });
});

describe('completion letter template and filenames', () => {
  it('embeds logo, stamp, Sakkal Majalla, RTL, and عاصم القيسي', () => {
    const html = buildOfficialCompletionLetterHtml({
      letterNo: 'FT-1',
      studentName: 'أحمد الرماضين',
      universityNumber: '120232221002',
      universityName: 'جامعة مؤتة',
      specialtyName: 'هندسة',
      opportunityTitle: 'التدريب الميداني الصيفي',
      startDate: '2025-07-01',
      endDate: '2025-08-31',
      completedHours: 140,
      attendancePct: 95,
      postScore: 80,
      verificationCode: 'abc',
      issuedAt: '2026-08-30',
    });
    assert.match(html, /dir="rtl"/);
    assert.match(html, new RegExp(SIGNATORY_TITLE));
    assert.match(html, new RegExp(SIGNATORY_NAME));
    assert.match(html, new RegExp(FONT_FAMILY));
    assert.match(html, /أحمد الرماضين/);
    assert.match(html, /120232221002/);
    assert.ok(loadLogoDataUri().startsWith('data:image/png'));
    assert.ok(loadStampDataUri().startsWith('data:image/svg+xml'));
    const fontCss = loadFontFaceCss();
    assert.ok(fontCss.includes(FONT_FAMILY) || fontCss === '');
  });

  it('builds Arabic PDF and ZIP filenames', () => {
    const pdf = buildCompletionLetterPdfFilename({
      studentName: 'أحمد الرماضين',
      universityNumber: '120232221002',
    });
    assert.equal(pdf, 'أحمد_الرماضين_120232221002_كتاب_إنهاء_التدريب.pdf');
    const zip = buildCompletionLettersZipFilename({
      opportunityName: 'التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026',
      date: '2026-08-30',
    });
    assert.match(zip, /^كتب_إنهاء_التدريب_/);
    assert.match(zip, /2026-08-30\.zip$/);
    const header = contentDispositionAttachment(zip);
    assert.match(header, /filename\*=UTF-8''/);
    assert.ok(header.includes(encodeURIComponent(zip)));
  });

  it('skips unchanged issued letters and requires 140 hours plus eligible status', () => {
    const hash = computeLetterSourceHash({ studentName: 'أ', universityNumber: '1' });
    const skip = classifyStudent(
      { completion_eligibility_status: 'eligible', completed_training_hours: 140, training_status: 'completed' },
      { status: 'issued', source_data_hash: hash },
      hash
    );
    assert.equal(skip.skipReason, 'source_unchanged');
    const hours = classifyStudent(
      { completion_eligibility_status: 'eligible', completed_training_hours: 120, training_status: 'in_training' },
      null,
      hash
    );
    assert.equal(hours.skipReason, 'hours_below_minimum');
    assert.equal(MIN_COMPLETION_LETTER_HOURS, 140);
    const ineligible = classifyStudent(
      { completion_eligibility_status: 'pending', completed_training_hours: 200, training_status: 'in_training' },
      null,
      hash
    );
    assert.equal(ineligible.skipReason, 'not_eligible');
  });

  it('packs distinct student PDFs into supervisor folders with readable Arabic names', async () => {
    const { stream, included } = await buildCompletionLettersZip(
      [
        {
          applicationId: 'a1',
          studentName: 'أحمد',
          universityNumber: '111',
          supervisorFolder: 'زكريا الطراونه',
          buffer: Buffer.from('%PDF-1.4 A'),
        },
        {
          applicationId: 'a2',
          studentName: 'سارة',
          universityNumber: '222',
          supervisorFolder: 'د. خالد الطراونة',
          buffer: Buffer.from('%PDF-1.4 B'),
        },
      ]
    );
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));
    const names = Object.keys(zip.files);
    assert.equal(included.length, 2);
    assert.ok(names.includes('زكريا الطراونه/أحمد_111_كتاب_إنهاء_التدريب.pdf'));
    assert.ok(names.includes('د. خالد الطراونة/سارة_222_كتاب_إنهاء_التدريب.pdf'));
    const first = await zip.file('زكريا الطراونه/أحمد_111_كتاب_إنهاء_التدريب.pdf').async('nodebuffer');
    const second = await zip.file('د. خالد الطراونة/سارة_222_كتاب_إنهاء_التدريب.pdf').async('nodebuffer');
    assert.notEqual(first.toString(), second.toString());
  });
});

describe('academic supervisor isolation', () => {
  it('does not filter reviewer students by a supervisor account', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    const admin = makeRequester({ roles: ['admin'], userId: SYNTH_USER_B, universityId: SYNTH_UNI_A });
    const superAdmin = makeGlobalSuperAdmin();
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(reviewer), false);
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(admin), false);
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(superAdmin), false);
    assert.deepEqual(supervisorScope.applicationSupervisorWhere(reviewer), {});
  });

  it('does not treat the reviewer account as a supervisor identity', async () => {
    const reviewer = makeRequester({ roles: ['reviewer'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    await supervisorScope.assertReviewerCanAccessApplication(reviewer, { id: null });
  });
});
