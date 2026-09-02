'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const fs = require('fs');
const {
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredCompleteFields,
  missingFieldEntries,
  validateCriteriaGrid,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');
const {
  buildFieldTrainingEligibilityReasons,
  reportEligibilityStatus,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');
const { buildEvaluationPdfFilename, buildOfficialEvaluationZipPath, buildOfficialEvaluationsZipFilename } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.filename');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const { fillDocxTemplate, inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { buildPlaceholderMap } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');
const {
  docxFingerprint,
  verifyFilledDocxFidelity,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.fidelity');
const {
  convertFilledDocxToPdf,
  findSoffice,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.pdf');
const {
  cellPlainText,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { officialTemplatePath } = require('../scripts/lib/mutahOfficialEvaluationTemplate');

const scores40 = {
  criterion1Score: 4,
  criterion2Score: 4,
  criterion3Score: 3,
  criterion4Score: 3,
  criterion5Score: 4,
  criterion6Score: 4,
  criterion7Score: 5,
  criterion8Score: 4,
  criterion9Score: 5,
  criterion10Score: 4,
};

function eligibleCtx(overrides = {}) {
  return {
    student: {
      full_name: 'أحمد كمال حمد الشواوره',
      university_student_number: '212022221209',
      university_specialty: { name_ar: 'أمن المعلومات والأدلة الرقمية' },
    },
    application: {
      completed_training_hours: 140,
      attendance_percentage: 100,
      completion_eligibility_status: 'eligible',
      academic_supervisor_name: 'زكريا الطراونه',
    },
    opportunity: {
      start_date: new Date('2026-07-01T00:00:00.000Z'),
      end_date: new Date('2026-09-01T00:00:00.000Z'),
      organization_name: 'شركة الاختبار',
      host_organization: {
        field_supervisor_name: 'المشرف الميداني',
        department: 'تقنية المعلومات',
        email: 'org@example.com',
        phone: '032345678',
        address: 'الكرك',
      },
    },
    attendanceRows: [
      { status: 'present', session_id: 's1' },
      { status: 'present', session_id: 's2' },
    ],
    evaluation: {
      ...scores40,
      professionalTotal: 40,
      eligibilityStatus: 'ELIGIBLE',
      generalComments: 'حالة الطالب: مؤهل',
      evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}

describe('Mutah evaluation generator mapping', () => {
  it('has no HTML, Mammoth, or Puppeteer fallback in the official evaluation PDF path', () => {
    const pdfSource = fs.readFileSync(
      require.resolve('../src/modules/fieldTraining/fieldTrainingEvaluation.pdf'),
      'utf8'
    );
    const serviceSource = fs.readFileSync(
      require.resolve('../src/modules/fieldTraining/fieldTrainingEvaluation.service'),
      'utf8'
    );
    assert.doesNotMatch(pdfSource, /mammoth|renderHtmlToPdf|puppeteer/i);
    assert.doesNotMatch(serviceSource, /renderStudentReportHtml|fieldTrainingReport\.template/);
    assert.match(pdfSource, /FIELD_TRAINING_TEMPLATE_RENDER_FAILED|PDF_RENDER_FAILED_CODE/);
  });

  it('previews the same stored verified PDF instead of rendering a second artifact', () => {
    const serviceSource = fs.readFileSync(
      require.resolve('../src/modules/fieldTraining/fieldTrainingEvaluation.service'),
      'utf8'
    );
    const start = serviceSource.indexOf('async function previewApplicationReportPdf');
    const end = serviceSource.indexOf('async function saveOpportunityReportDefaults', start);
    const previewSource = serviceSource.slice(start, end);
    assert.match(previewSource, /await downloadPdf\(user, current\.id\)/);
    assert.match(previewSource, /artifactSource:\s*'stored_verified_pdf'/);
    assert.doesNotMatch(previewSource, /fillDocxTemplate|convertFilledDocxToPdf/);
  });

  it('maps Mutah hours as total completed hours 140, not hours per day', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    assert.equal(payload.training_hours_display, 140);
    assert.equal(payload.actual_training_hours, 140);
    assert.notEqual(payload.training_hours_display, 70);
  });

  it('computes professional total 40/50 from the required scores', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    assert.equal(validateCriteriaGrid(payload).total, 40);
    assert.equal(payload.professional_evaluation_total, 40);
  });

  it('puts academic supervisor into responsible_person_name and keeps field supervisor separate', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    assert.equal(payload.responsible_person_name, 'زكريا الطراونه');
    assert.equal(payload.academic_supervisor_name, 'زكريا الطراونه');
    assert.equal(payload.field_supervisor_name, 'المشرف الميداني');
    assert.notEqual(payload.field_supervisor_name, payload.responsible_person_name);
  });

  it('classifies missing specialty as missing required data, not ineligibility', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(
      eligibleCtx({ student: { full_name: 'أحمد محمد', university_student_number: '202312345' } })
    );
    const missing = missingRequiredCompleteFields(payload);
    assert.ok(missing.includes('student_specialty'));
    const entries = missingFieldEntries(payload);
    assert.ok(entries.some((row) => row.code === 'STUDENT_SPECIALTY_MISSING'));
    assert.equal(reportEligibilityStatus({ completion_eligibility_status: 'eligible' }), 'ELIGIBLE');
  });

  it('keeps below-minimum attendance as NOT_ELIGIBLE with generated comments, not missing data', () => {
    const reasons = buildFieldTrainingEligibilityReasons({
      application: {
        completion_eligibility_status: 'ineligible',
        eligibility_reason: {
          reasons: ['attendance_below_minimum', 'training_hours_incomplete', 'post_assessment_missing'],
          details: {
            attendance_percentage: 72,
            minimum_attendance_percentage: 80,
            training_hours: { completed_hours: 118, required_hours: 140 },
          },
        },
      },
      evidence: { requiredTaskCount: 4, acceptedTaskCount: 2 },
    });
    assert.ok(reasons.labelsAr.some((line) => line.includes('72%') && line.includes('80%')));
    assert.ok(reasons.labelsAr.some((line) => line.includes('118') && line.includes('140')));
    const comment = buildAutoComment(
      { eligibilityStatus: 'NOT_ELIGIBLE' },
      { eligibilityStatus: 'NOT_ELIGIBLE', reasonLabels: reasons.labelsAr }
    );
    assert.match(comment, /غير مؤهل/);
    assert.match(comment, /أسباب عدم التأهيل/);
    assert.doesNotMatch(comment, /^غير مؤهل$/);
  });

  it('builds an eligible comment without fabricating praise', () => {
    const comment = buildAutoComment(
      { eligibilityStatus: 'ELIGIBLE', professionalTotal: 40, criterion4Score: 3 },
      { eligibilityStatus: 'ELIGIBLE' }
    );
    assert.match(comment, /مؤهل/);
    assert.doesNotMatch(comment, /undefined|null/i);
  });

  it('classifies missing teamwork rating without fabricating a score, then becomes ready after it is entered', () => {
    const missingTeamwork = buildFieldTrainingEvaluationTemplatePayload(
      eligibleCtx({
        evaluation: {
          ...scores40,
          criterion6Score: null,
          professionalTotal: 36,
          eligibilityStatus: 'ELIGIBLE',
          generalComments: 'حالة الطالب: مؤهل',
          evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      })
    );
    const missing = missingRequiredCompleteFields(missingTeamwork);
    assert.ok(missing.includes('criterion_6_score'));
    assert.ok(missingFieldEntries(missingTeamwork).some((row) => row.code === 'PROFESSIONAL_RATING_TEAMWORK_MISSING'));
    assert.equal(missingTeamwork.criterion_6_score, null);
    const restored = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    assert.equal(missingRequiredCompleteFields(restored).length, 0);
    assert.equal(restored.criterion_6_score, 4);
  });

  it('fills the official Mutah template with eligible page-1 data, ten checkmarks, and total 40', async () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    const filled = await fillDocxTemplate(
      fs.readFileSync(officialTemplatePath()),
      buildPlaceholderMap({ ...payload })
    );
    const inspect = await inspectFilledDocx(filled);
    assert.match(inspect.text, /أحمد كمال حمد الشواوره/);
    assert.match(inspect.text, /212022221209/);
    assert.match(inspect.text, /أمن المعلومات والأدلة الرقمية/);
    assert.match(inspect.text, /140/);
    assert.match(inspect.text, /زكريا الطراونه/);
    assert.match(inspect.text, /المشرف الميداني/);
    assert.match(inspect.text, /المجموع: 40/);
    assert.equal(inspect.checkmarks, 10);
    assert.equal(inspect.hasOfficialStamp, true);
    assert.ok(inspect.media.length >= 4);

    const zip = await JSZip.loadAsync(filled);
    const documentXml = await zip.file('word/document.xml').async('string');
    const scoreTable = [...documentXml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
      .map((match) => match[0])
      .find((table) => /مجال التقييم/.test(cellPlainText(table)));
    const { ratingColumnIndexForScore, scoreGridHeaderCells } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
    assert.equal(/<w:bidiVisual/.test(scoreTable), false);
    const headerCells = scoreGridHeaderCells(scoreTable);
    assert.match(headerCells[headerCells.length - 1], /الرقم/);
    assert.match(headerCells[headerCells.length - 2], /مجال التقييم/);
    assert.match(headerCells[0], /(?:ف|ض)عيف\s*1/);
    assert.match(headerCells[4], /ممتاز\s*5/);
    assert.match(inspect.text, /45/);
    const rows = [...scoreTable.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].slice(1, 11);
    const expectedScores = Object.values(scores40);
    rows.forEach((row, index) => {
      const scoreCells = [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
      const marked = scoreCells
        .map((cell, cellIndex) =>
          cellPlainText(cell[0]).includes('✓') ? cellIndex + 1 : null
        )
        .filter(Boolean);
      const expectedCol = ratingColumnIndexForScore(headerCells, expectedScores[index]) + 1;
      assert.deepEqual(marked, [expectedCol]);
    });
  });

  it('keeps unknown attendance, absence, and hours null instead of fabricating zero', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(
      eligibleCtx({
        application: {
          attendance_percentage: null,
          completed_training_hours: 0,
          hours_updated_at: null,
          academic_supervisor_name: 'زكريا الطراونه',
          completion_eligibility_status: 'ineligible',
        },
        attendanceRows: [],
        evaluation: { eligibilityStatus: 'NOT_ELIGIBLE' },
      })
    );
    assert.equal(payload.training_days, null);
    assert.equal(payload.actual_training_hours, null);
    assert.equal(payload.training_hours_display, null);
    assert.equal(payload.absence_days, null);
    const missing = missingRequiredCompleteFields(payload);
    assert.ok(missing.includes('training_days'));
    assert.ok(missing.includes('training_hours_display'));
    assert.ok(missing.includes('absence_days'));
  });

  it('regresses Omar 120232222080 without the old blank/zero/misplaced DOCX output', async () => {
    const template = fs.readFileSync(officialTemplatePath());
    const omarCtx = eligibleCtx({
      student: {
        full_name: 'عمر محمد ثلجي المواجده',
        university_student_number: '120232222080',
        university_specialty: { name_ar: 'علم البيانات والذكاء الاصطناعي' },
      },
      application: {
        completed_training_hours: 0,
        hours_updated_at: null,
        attendance_percentage: 100,
        completion_eligibility_status: 'ineligible',
        academic_supervisor_name: 'أ.د. احمد الحسنات',
      },
      opportunity: {
        start_date: new Date('2026-07-23T00:00:00.000Z'),
        end_date: new Date('2026-09-05T00:00:00.000Z'),
        organization_name: 'شركة الرجل الوطواط للتكنولوجيا',
        host_organization: {
          department: 'قسم تكنولوجيا المعلومات',
          email: 'it@battechno.com',
          phone: '0798040280',
          fax: '',
          address: 'عمان - شارع المدينة المنورة - مجمع الباسم 2',
          field_supervisor_name: 'عاصم القيسي',
        },
      },
      attendanceRows: Array.from({ length: 5 }, (_, index) => ({
        status: 'present',
        session_id: `omar-session-${index + 1}`,
        field_training_sessions: {
          id: `omar-session-${index + 1}`,
          start_time: '16:00',
          end_time: '18:00',
        },
      })),
      evaluation: {
        ...scores40,
        professionalTotal: 40,
        eligibilityStatus: 'NOT_ELIGIBLE',
        eligibilityReasons: ['REQUIRED_HOURS_INCOMPLETE'],
        eligibilityReasonLabels: ['لم يستكمل الساعات التدريبية المطلوبة (10 من 140).'],
        generalComments:
          'حالة الطالب: غير مؤهل\n\nأسباب عدم التأهيل:\n* لم يستكمل الساعات التدريبية المطلوبة (10 من 140).',
        evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    const payload = buildFieldTrainingEvaluationTemplatePayload(omarCtx);
    assert.equal(payload.semester, 'الصيفي');
    assert.equal(payload.academic_year, '2025-2026');
    assert.equal(payload.training_days, 5);
    assert.equal(payload.actual_training_hours, 10);
    assert.equal(payload.training_hours_display, 10);
    assert.equal(payload.absence_days, 0);
    assert.equal(payload.field_supervisor_name, 'عاصم القيسي');
    assert.equal(payload.responsible_person_name, 'أ.د. احمد الحسنات');

    const filled = await fillDocxTemplate(
      Buffer.from(template),
      buildPlaceholderMap(payload)
    );
    const inspection = await inspectFilledDocx(filled);
    const fingerprint = await docxFingerprint(filled);
    const normalized = fingerprint.text.replace(/\s+/g, ' ');
    const comment = payload.general_comments.replace(/\s+/g, ' ');
    assert.match(normalized, /عمر محمد ثلجي المواجده/);
    assert.match(normalized, /120232222080/);
    assert.match(normalized, /23 \/ 7 \/ 2026/);
    assert.match(normalized, /5 \/ 9 \/ 2026/);
    assert.match(normalized, /اسم الشركة أو المؤسسة:\s*شركة الرجل الوطواط للتكنولوجيا/);
    assert.match(normalized, /العنوان:\s*عمان - شارع المدينة المنورة - مجمع الباسم 2/);
    assert.match(normalized, /المجموع:\s*40/);
    assert.equal(normalized.split(comment).length - 1, 1);
    assert.equal(inspection.checkmarks, 10);
    assert.equal(normalized.includes('BATTECHNO LMS'), false);
    assert.equal(normalized.includes('هذا التقرير للاستخدام الإداري الداخلي'), false);
    assert.equal(normalized.includes('Instructor BATUNI'), false);
    assert.equal(normalized.includes('BATUNI Instructor'), false);
    await verifyFilledDocxFidelity({
      templateBuffer: template,
      filledBuffer: filled,
      payload,
    });

    if (findSoffice()) {
      const pdf = await convertFilledDocxToPdf(filled, { expectedPageCount: 2 });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    }
  });

  it('uses the official Arabic filename with name and university number', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload(eligibleCtx());
    const filename = buildEvaluationPdfFilename({
      studentName: payload.student_name,
      universityNumber: payload.student_number,
    });
    assert.equal(filename, 'أحمد_كمال_حمد_الشواوره_212022221209_تقييم_التدريب_الميداني.pdf');
  });
});

describe('Mutah evaluation ZIP hierarchy', () => {
  it('nests PDFs under university / exact academic supervisor / eligibility folders', async () => {
    const { buffer, included } = await buildReportsZip(
      [
        {
          universityName: 'جامعة مؤتة',
          academicSupervisorName: 'زكريا الطراونه',
          eligibilityStatus: 'ELIGIBLE',
          studentName: 'أحمد محمد',
          universityNumber: '202312345',
          buffer: Buffer.from('a'),
        },
        {
          universityName: 'جامعة مؤتة',
          academicSupervisorName: 'د. خالد الطراونة',
          eligibilityStatus: 'NOT_ELIGIBLE',
          studentName: 'محمد خالد',
          universityNumber: '202312350',
          buffer: Buffer.from('b'),
        },
        {
          universityName: 'جامعة مؤتة',
          academicSupervisorName: 'د.احمد الطراونة',
          eligibilityStatus: 'ELIGIBLE',
          studentName: 'سارة خالد',
          universityNumber: '202312346',
          buffer: Buffer.from('c'),
        },
        {
          universityName: 'جامعة مؤتة',
          academicSupervisorName: '',
          eligibilityStatus: 'ELIGIBLE',
          studentName: 'بدون مشرف',
          universityNumber: '202300001',
          buffer: Buffer.from('d'),
        },
      ],
      { officialFolders: true }
    );
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    assert.ok(names.some((name) => name.startsWith('جامعة مؤتة/')));
    assert.ok(zip.file('جامعة مؤتة/زكريا الطراونه/مؤهل/أحمد_محمد_202312345_تقييم_التدريب_الميداني.pdf'));
    assert.ok(zip.file('جامعة مؤتة/د. خالد الطراونة/غير مؤهل/محمد_خالد_202312350_تقييم_التدريب_الميداني.pdf'));
    assert.ok(zip.file('جامعة مؤتة/د.احمد الطراونة/مؤهل/سارة_خالد_202312346_تقييم_التدريب_الميداني.pdf'));
    assert.ok(zip.file('جامعة مؤتة/مشرف غير محدد/مؤهل/بدون_مشرف_202300001_تقييم_التدريب_الميداني.pdf'));
    assert.equal(included.length, 4);
    const zipName = buildOfficialEvaluationsZipFilename({ universityName: 'جامعة مؤتة', academicYear: '2025-2026' });
    assert.equal(zipName, 'جامعة_مؤتة_تقارير_تقييم_التدريب_الميداني_2025-2026.zip');
    assert.notEqual(
      buildOfficialEvaluationZipPath({
        universityName: 'جامعة مؤتة',
        academicSupervisorName: 'زكريا الطراونه',
        eligibilityStatus: 'ELIGIBLE',
        filename: 'a.pdf',
      }),
      buildOfficialEvaluationZipPath({
        universityName: 'جامعة مؤتة',
        academicSupervisorName: 'د. خالد الطراونة',
        eligibilityStatus: 'ELIGIBLE',
        filename: 'a.pdf',
      })
    );
  });
});

describe('cross-student isolation', () => {
  it('keeps Student A and Student B data in separate filled documents', async () => {
    const template = fs.readFileSync(officialTemplatePath());
    const payloadA = buildFieldTrainingEvaluationTemplatePayload(
      eligibleCtx({
        student: {
          full_name: 'طالب ألف',
          university_student_number: '111111111',
          university_specialty: { name_ar: 'أمن المعلومات والأدلة الرقمية' },
        },
      })
    );
    const payloadB = buildFieldTrainingEvaluationTemplatePayload(
      eligibleCtx({
        student: {
          full_name: 'طالب باء',
          university_student_number: '222222222',
          university_specialty: { name_ar: 'علم الحاسوب' },
        },
        evaluation: {
          ...scores40,
          criterion1Score: 1,
          professionalTotal: 37,
          eligibilityStatus: 'NOT_ELIGIBLE',
          generalComments: 'حالة الطالب: غير مؤهل',
          evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      })
    );
    const filledA = await fillDocxTemplate(Buffer.from(template), buildPlaceholderMap({ ...payloadA }));
    const filledB = await fillDocxTemplate(Buffer.from(template), buildPlaceholderMap({ ...payloadB }));
    const inspectA = await inspectFilledDocx(filledA);
    const inspectB = await inspectFilledDocx(filledB);
    assert.match(inspectA.text, /طالب ألف/);
    assert.match(inspectA.text, /111111111/);
    assert.equal(inspectA.text.includes('طالب باء'), false);
    assert.equal(inspectA.text.includes('222222222'), false);
    assert.match(inspectB.text, /طالب باء/);
    assert.match(inspectB.text, /222222222/);
    assert.equal(inspectB.text.includes('طالب ألف'), false);
    assert.equal(inspectA.checkmarks, 10);
    assert.equal(inspectB.checkmarks, 10);
    assert.equal(inspectA.hasOfficialStamp, true);
    assert.ok(inspectA.media.length >= 4);
  });
});
