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
const { resolveSupervisorAccount, previewCanApply } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.service');
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
const { classifyStudent, selectBulkIssueTargets } = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
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

describe('academic supervisor resolution', () => {
  const reviewers = [
    { id: 'u1', full_name: 'د. خالد الطراونة', email: 'khaled@mutah.edu.jo' },
    { id: 'u2', full_name: 'د.احمد الطراونة', email: 'ahmad@mutah.edu.jo' },
    { id: 'u3', full_name: 'د. خالد الطراونة', email: 'khaled2@mutah.edu.jo' },
  ];

  it('matches only an exact unique name and never a partial الطراونة guess', () => {
    const unique = resolveSupervisorAccount({
      group: { supervisorLabel: 'د.احمد الطراونة', supervisorNormalized: normalizePersonLabel('د.احمد الطراونة'), rows: [] },
      reviewers: reviewers.slice(0, 2),
      mappings: new Map(),
    });
    assert.equal(unique.status, 'linked');
    assert.equal(unique.account.id, 'u2');

    const none = resolveSupervisorAccount({
      group: { supervisorLabel: 'الطراونة', supervisorNormalized: normalizePersonLabel('الطراونة'), rows: [] },
      reviewers: reviewers.slice(0, 2),
      mappings: new Map(),
    });
    assert.equal(none.status, 'unlinked');
  });

  it('requires manual selection when multiple accounts share the same full name', () => {
    const result = resolveSupervisorAccount({
      group: { supervisorLabel: 'د. خالد الطراونة', supervisorNormalized: normalizePersonLabel('د. خالد الطراونة'), rows: [] },
      reviewers,
      mappings: new Map(),
    });
    assert.equal(result.status, 'ambiguous');
    assert.equal(result.matches.length, 2);
  });

  it('lets a name-only Excel preview apply without LMS supervisor accounts', () => {
    assert.equal(
      previewCanApply({ invalidRows: 0, duplicateUniversityNumbers: 0, conflictingAssignments: 0 }),
      true
    );
    assert.equal(
      previewCanApply({ invalidRows: 1, duplicateUniversityNumbers: 0, conflictingAssignments: 0 }),
      false
    );
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
    assert.match(html, /info-label">الرقم الجامعي:<\/span>/);
    assert.doesNotMatch(html, /\.info-row[\s\S]*justify-content:\s*space-between/);
    assert.match(html, /كتاب إنهاء تدريب ميداني/);
    assert.match(html, /إلى من يهمه الأمر/);
    assert.match(html, /الرجل الوطواط للتكنولوجيا/);
    assert.match(html, new RegExp(SIGNATORY_TITLE));
    assert.match(html, new RegExp(SIGNATORY_NAME));
    assert.match(html, new RegExp(FONT_FAMILY));
    assert.match(html, /أحمد الرماضين/);
    assert.match(html, /120232221002/);
    assert.ok(loadLogoDataUri().startsWith('data:image/png'));
    assert.ok(loadStampDataUri().startsWith('data:image/png'));
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
      { status: 'issued', source_data_hash: hash, pdf_url: 'letters/a.pdf', file_ready: true },
      hash
    );
    assert.equal(skip.skipReason, 'source_unchanged');
    const missingFile = classifyStudent(
      { completion_eligibility_status: 'eligible', completed_training_hours: 140, training_status: 'completed' },
      { status: 'issued', source_data_hash: hash, pdf_url: null, file_ready: false },
      hash
    );
    assert.equal(missingFile.regenerate, true);
    assert.equal(Boolean(missingFile.alreadyIssued), false);
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

  it('packs PDFs into supervisor folders without merging similar الطراونة names', async () => {
    const { stream, included } = await buildCompletionLettersZip([
      {
        applicationId: 'a1',
        studentName: 'أحمد',
        universityNumber: '111',
        supervisorName: 'زكريا الطراونه',
        buffer: Buffer.from('%PDF-1.4 A'),
      },
      {
        applicationId: 'a2',
        studentName: 'محمد',
        universityNumber: '112',
        supervisorName: 'زكريا الطراونه',
        buffer: Buffer.from('%PDF-1.4 B'),
      },
      {
        applicationId: 'a3',
        studentName: 'سارة',
        universityNumber: '113',
        supervisorName: 'د. خالد الطراونة',
        buffer: Buffer.from('%PDF-1.4 C'),
      },
      {
        applicationId: 'a4',
        studentName: 'ليلى',
        universityNumber: '114',
        supervisorName: 'د.احمد الطراونة',
        buffer: Buffer.from('%PDF-1.4 D'),
      },
      {
        applicationId: 'a5',
        studentName: 'طالب',
        universityNumber: '115',
        supervisorName: '',
        buffer: Buffer.from('%PDF-1.4 E'),
      },
    ]);
    const chunks = [];
    await new Promise((resolve, reject) => {
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));
    const names = Object.keys(zip.files);
    assert.equal(included.length, 5);
    assert.ok(names.includes('زكريا الطراونه/أحمد_111_كتاب_إنهاء_التدريب.pdf'));
    assert.ok(names.includes('زكريا الطراونه/محمد_112_كتاب_إنهاء_التدريب.pdf'));
    assert.ok(names.includes('د. خالد الطراونة/سارة_113_كتاب_إنهاء_التدريب.pdf'));
    assert.ok(names.includes('د.احمد الطراونة/ليلى_114_كتاب_إنهاء_التدريب.pdf'));
    assert.ok(names.includes('مشرف غير محدد/طالب_115_كتاب_إنهاء_التدريب.pdf'));
    assert.equal(names.some((n) => n === 'أحمد_111_كتاب_إنهاء_التدريب.pdf'), false);
    const first = await zip.file('زكريا الطراونه/أحمد_111_كتاب_إنهاء_التدريب.pdf').async('nodebuffer');
    const second = await zip.file('زكريا الطراونه/محمد_112_كتاب_إنهاء_التدريب.pdf').async('nodebuffer');
    assert.notEqual(first.toString(), second.toString());
  });
});

describe('academic supervisor isolation', () => {
  it('scopes reviewers to assigned students only and lets admin see all', () => {
    const reviewer = makeRequester({ roles: ['reviewer'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    const admin = makeRequester({ roles: ['admin'], userId: SYNTH_USER_B, universityId: SYNTH_UNI_A });
    const superAdmin = makeGlobalSuperAdmin();
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(reviewer), true);
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(admin), false);
    assert.equal(supervisorScope.shouldScopeToAssignedSupervisor(superAdmin), false);
    const where = supervisorScope.applicationSupervisorWhere(reviewer);
    assert.equal(where.field_training_academic_supervisor_assignments.is.supervisor_user_id, SYNTH_USER_A);
  });

  it('denies a reviewer accessing another reviewer student', async () => {
    const reviewer = makeRequester({ roles: ['reviewer'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    let thrown = null;
    try {
      await supervisorScope.assertReviewerCanAccessApplication(reviewer, { id: null });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof ApiError);
    assert.equal(thrown.statusCode, 403);
  });
});

describe('completion letter route handlers', () => {
  it('exports preview and academic download handlers required by mounted routes', () => {
    const ctrl = require('../src/modules/fieldTraining/fieldTraining.workflow.controller');
    assert.equal(typeof ctrl.previewOwnCompletionLetter, 'function');
    assert.equal(typeof ctrl.previewCompletionLetterAsManager, 'function');
    assert.equal(typeof ctrl.previewCompletionLetterAsAcademic, 'function');
    assert.equal(typeof ctrl.downloadCompletionLetterAsAcademic, 'function');
    assert.equal(typeof ctrl.downloadCompletionLetterAsManager, 'function');
  });
});

describe('completion letter bulk targeting and isolation', () => {
  it('retries failed students only and skips unchanged hashes', () => {
    const hash = computeLetterSourceHash({ studentName: 'أ', universityNumber: '1' });
    const students = [
      { id: 'ok', will_issue: false, will_regenerate: false, skip_reason: 'source_unchanged' },
      { id: 'fail-1', will_issue: false, will_regenerate: false },
      { id: 'new', will_issue: true, will_regenerate: false },
    ];
    const retry = selectBulkIssueTargets(students, ['fail-1']);
    assert.deepEqual(retry.map((row) => row.id), ['fail-1']);
    const first = selectBulkIssueTargets(students, []);
    assert.deepEqual(first.map((row) => row.id), ['new']);
    const skip = classifyStudent(
      { completion_eligibility_status: 'eligible', completed_training_hours: 140 },
      { status: 'issued', source_data_hash: hash, pdf_url: 'letters/a.pdf', file_ready: true },
      hash
    );
    assert.equal(skip.skipReason, 'source_unchanged');
    assert.equal(skip.alreadyIssued, true);
  });
});

describe('completion letter PDF identity isolation', () => {
  it('renders two student letters without mixing names or university numbers', { timeout: 120000 }, async () => {
    const { renderHtmlToPdf } = require('../src/modules/analytics/pdfRenderer');
    const htmlA = buildOfficialCompletionLetterHtml({
      letterNo: 'FT-A',
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
      verificationCode: 'aaa',
      issuedAt: '2026-08-31',
    });
    const htmlB = buildOfficialCompletionLetterHtml({
      letterNo: 'FT-B',
      studentName: 'سارة الطراونة',
      universityNumber: '120232221099',
      universityName: 'جامعة مؤتة',
      specialtyName: 'علوم',
      opportunityTitle: 'التدريب الميداني الصيفي',
      startDate: '2025-07-01',
      endDate: '2025-08-31',
      completedHours: 160,
      attendancePct: 90,
      postScore: 88,
      verificationCode: 'bbb',
      issuedAt: '2026-08-31',
    });
    assert.match(htmlA, /أحمد الرماضين/);
    assert.match(htmlA, /120232221002/);
    assert.equal(htmlA.includes('سارة الطراونة'), false);
    assert.match(htmlB, /سارة الطراونة/);
    assert.match(htmlB, /120232221099/);
    assert.equal(htmlB.includes('أحمد الرماضين'), false);

    const pdfA = await renderHtmlToPdf(htmlA, { lang: 'ar' });
    const pdfB = await renderHtmlToPdf(htmlB, { lang: 'ar' });
    assert.ok(Buffer.isBuffer(pdfA) && pdfA.length > 1000);
    assert.ok(Buffer.isBuffer(pdfB) && pdfB.length > 1000);
    assert.notEqual(pdfA.equals(pdfB), true);

    let parsePdf;
    try {
      parsePdf = require('pdf-parse');
    } catch {
      parsePdf = null;
    }
    if (parsePdf) {
      const textA = String((await parsePdf(pdfA)).text || '');
      const textB = String((await parsePdf(pdfB)).text || '');
      assert.match(textA, /120232221002/);
      assert.equal(textA.includes('120232221099'), false);
      assert.match(textB, /120232221099/);
      assert.equal(textB.includes('120232221002'), false);
      assert.match(textA, /عاصم/);
      assert.match(textB, /عاصم/);
    }
  });
});
