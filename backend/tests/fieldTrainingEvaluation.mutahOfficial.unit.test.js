'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { ApiError } = require('../src/utils/apiError');
const access = require('../src/modules/fieldTraining/fieldTrainingEvaluation.access');
const { resolveEvaluationTemplate } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.resolve');
const { shouldReuseStoredPdf } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const {
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredCompleteFields,
  validateCriteriaGrid,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const { resolveOfficialUniversityNumber } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.universityNumber');
const { buildEvaluationPdfFilename } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.filename');
const { buildPlaceholderMap, gridCheckmarks } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');
const { fillDocxTemplate, inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { convertFilledDocxToPdf, findSoffice } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.pdf');
const { CHECKMARK } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const {
  officialTemplatePath,
  isMutahUniversity,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
} = require('../scripts/lib/mutahOfficialEvaluationTemplate');
const {
  SYNTH_UNI_A,
  SYNTH_UNI_B,
  SYNTH_USER_A,
  SYNTH_USER_B,
  makeRequester,
} = require('./helpers/authzFixtures');

const scores = {
  criterion1Score: 5,
  criterion2Score: 4,
  criterion3Score: 5,
  criterion4Score: 4,
  criterion5Score: 5,
  criterion6Score: 3,
  criterion7Score: 4,
  criterion8Score: 5,
  criterion9Score: 4,
  criterion10Score: 5,
};

function samplePayload(overrides = {}) {
  return buildFieldTrainingEvaluationTemplatePayload({
    student: {
      id: '11111111-1111-1111-1111-111111111111',
      full_name: 'محمد أحمد الطراونة',
      university_student_number: '2020123456',
      university_specialty: { name_ar: 'الأمن السيبراني' },
    },
    application: {
      completed_training_hours: 140,
      attendance_percentage: 100,
      completion_eligibility_status: 'eligible',
      academic_supervisor_name: 'زكريا الطراونه',
    },
    opportunity: {
      start_date: new Date('2026-07-23T00:00:00.000Z'),
      end_date: new Date('2026-09-05T00:00:00.000Z'),
      organization_name: 'شركة الاختبار',
      host_organization: {
        field_supervisor_name: 'المشرف الميداني',
        contact_person: 'المشرف الميداني',
        department: 'تقنية المعلومات',
        email: 'org@example.com',
        phone: '032345678',
        fax: '032345679',
        address: 'الكرك',
      },
    },
    instructor: { full_name: 'المشرف الميداني' },
    attendanceRows: [
      { status: 'present', session_id: 's1', field_training_sessions: { start_time: '08:00', end_time: '15:00' } },
      { status: 'present', session_id: 's2', field_training_sessions: { start_time: '08:00', end_time: '15:00' } },
    ],
    evaluation: {
      ...scores,
      professionalTotal: 44,
      generalComments: 'أداء الطالب جيد وملتزم.',
      evaluationDate: new Date('2026-08-20T00:00:00.000Z'),
    },
    ...overrides,
  });
}

describe('Mutah official evaluation template registration helpers', () => {
  it('points at the official Mutah DOCX asset', () => {
    const filePath = officialTemplatePath();
    assert.equal(fs.existsSync(filePath), true);
    assert.ok(fs.statSync(filePath).size > 1000);
    assert.equal(isMutahUniversity({ name: 'جامعة مؤتة' }), true);
    assert.equal(isMutahUniversity({ name: 'جامعة اليرموك' }), false);
    assert.match(OFFICIAL_MUTAH_TEMPLATE_NAME, /مؤتة/);
  });
});

describe('Mutah template resolution priority', () => {
  const mutahDefault = { id: 'mutah-default', university_id: 'mutah', is_active: true };
  const override = { id: 'opp-override', university_id: 'mutah', is_active: true };
  const otherUni = { id: 'ttu-default', university_id: 'ttu', is_active: true, is_default: true };
  const globalFallback = { id: 'global', university_id: 'other', is_active: true, is_default: true };

  it('gives Mutah opportunities the Mutah university default when there is no override', () => {
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: 'mutah' },
      universityDefault: mutahDefault,
      globalFallback,
    });
    assert.equal(resolved.source, 'university_default');
    assert.equal(resolved.template.id, 'mutah-default');
  });

  it('keeps an opportunity-specific override in front of the Mutah default', () => {
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: 'mutah', evaluation_template_id: 'opp-override' },
      assignedTemplate: override,
      universityDefault: mutahDefault,
      globalFallback,
    });
    assert.equal(resolved.source, 'opportunity');
    assert.equal(resolved.template.id, 'opp-override');
  });

  it('does not silently replace a missing assigned version with the university default', () => {
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: 'mutah', evaluation_template_id: 'missing-version' },
      assignedTemplate: null,
      universityDefault: mutahDefault,
    });
    assert.equal(resolved.source, 'assigned_template_unavailable');
    assert.equal(resolved.template, null);
  });

  it('does not assign the Mutah default to another university that already has its own default', () => {
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: 'ttu' },
      universityDefault: otherUni,
      globalFallback: mutahDefault,
    });
    assert.equal(resolved.source, 'university_default');
    assert.equal(resolved.template.id, 'ttu-default');
    assert.equal(resolved.template.university_id, 'ttu');
  });

  it('fails closed instead of borrowing a global template from another university', () => {
    const resolved = resolveEvaluationTemplate({
      opportunity: { university_id: 'new-uni' },
      universityDefault: null,
      globalFallback,
    });
    assert.equal(resolved.source, 'missing');
    assert.equal(resolved.template, null);
  });
});

describe('official Mutah DOCX fill', () => {
  it('replaces every supported field, writes ten checkmarks, and keeps stamp/signature media', async () => {
    const payload = samplePayload();
    assert.equal(missingRequiredCompleteFields(payload).length, 0);
    assert.equal(validateCriteriaGrid(payload).total, 44);
    assert.equal(payload.professional_evaluation_total, 44);
    const grid = gridCheckmarks(payload.criteria);
    const marks = Object.values(grid).filter((value) => value === CHECKMARK);
    assert.equal(marks.length, 10);

    const filled = await fillDocxTemplate(fs.readFileSync(officialTemplatePath()), buildPlaceholderMap(payload));
    const inspection = await inspectFilledDocx(filled);
    assert.deepEqual(inspection.unresolvedPlaceholders, []);
    assert.equal(inspection.checkmarks, 10);
    assert.equal(inspection.hasOfficialStamp, true);
    assert.equal(inspection.hasSignatures, true);
    assert.ok(inspection.media.length >= 4, 'logo, signatures, and stamp images remain in the zip');
    assert.match(inspection.text, /محمد أحمد الطراونة/);
    assert.match(inspection.text, /2020123456/);
    assert.match(inspection.text, /المشرف الميداني/);
    assert.match(inspection.text, /زكريا الطراونه/);
    assert.equal(inspection.text.includes('{{student_name}}'), false);
    assert.equal(/MERGEFIELD/i.test(inspection.text), false);
    assert.equal(inspection.text.includes(payload.field_supervisor_name), true);
    assert.equal(payload.responsible_person_name, 'زكريا الطراونه');
    assert.equal(payload.responsible_person_name !== payload.field_supervisor_name, true);
    assert.equal(payload.training_hours_display, 140);
    assert.equal(String(payload.training_hours_display).includes('3.11'), false);

    const zip = await JSZip.loadAsync(filled);
    assert.ok(zip.file('word/media/image1.png') || zip.file('word/media/image2.png'));
  });

  it('uses the Arabic download filename with the real name and university number', () => {
    const payload = samplePayload();
    const filename = buildEvaluationPdfFilename({
      studentName: payload.student_name,
      universityNumber: payload.student_number,
    });
    assert.equal(filename, 'محمد_أحمد_الطراونة_2020123456_تقييم_التدريب_الميداني.pdf');
    assert.equal(filename.includes('NA'), false);
    assert.equal(filename.includes('11111111'), false);
  });
});

describe('university number resolution', () => {
  it('uses the official profile field and never a UUID', () => {
    const fromProfile = resolveOfficialUniversityNumber({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      university_student_number: '20181234',
    });
    assert.equal(fromProfile.number, '20181234');
    assert.equal(fromProfile.persist, false);

    const uuidRejected = resolveOfficialUniversityNumber({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      university_student_number: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    assert.equal(uuidRejected.number, '');
  });

  it('extracts a valid number from a verified university email and flags it for persist', () => {
    const resolved = resolveOfficialUniversityNumber({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      email: '2020123456@mutah.edu.jo',
      email_verified_at: new Date(),
    });
    assert.equal(resolved.number, '2020123456');
    assert.equal(resolved.source, 'email');
    assert.equal(resolved.persist, true);
  });

  it('does not extract from unverified email or a non-numeric local-part', () => {
    const unverified = resolveOfficialUniversityNumber({
      email: '2020123456@mutah.edu.jo',
    });
    assert.equal(unverified.number, '');
    const nameLocal = resolveOfficialUniversityNumber({
      email: 'ahmad.khaled@mutah.edu.jo',
      email_verified_at: new Date(),
    });
    assert.equal(nameLocal.number, '');
  });
});

describe('complete-data and criteria validation', () => {
  it('rejects missing or out-of-range criteria and a total that is not the sum', () => {
    const incomplete = samplePayload({
      evaluation: { ...scores, criterion3Score: null, professionalTotal: 40, generalComments: 'x', evaluationDate: new Date() },
    });
    assert.ok(missingRequiredCompleteFields(incomplete).includes('criterion_3_score'));
    const bad = validateCriteriaGrid({ ...scores, criterion1Score: 9 });
    assert.equal(bad.ok, false);
  });

  it('requires comments, field supervisor, academic supervisor, and evaluation date before approval', () => {
    const payload = samplePayload({
      instructor: null,
      application: { completed_training_hours: 140, attendance_percentage: 100, academic_supervisor_name: '' },
      opportunity: {
        start_date: new Date('2026-07-23T00:00:00.000Z'),
        end_date: new Date('2026-09-05T00:00:00.000Z'),
        organization_name: 'شركة الاختبار',
        host_organization: {},
      },
      evaluation: { ...scores, professionalTotal: 44, generalComments: '', evaluationDate: null },
    });
    const missing = missingRequiredCompleteFields(payload);
    assert.ok(missing.includes('field_supervisor_name'));
    assert.ok(missing.includes('responsible_person_name'));
    assert.ok(missing.includes('general_comments'));
    assert.ok(missing.includes('evaluation_date'));
  });
});

describe('report download permissions and idempotent PDF reuse', () => {
  it('lets a reviewer download an approved report and blocks another student with 403', () => {
    const evaluationA = { student_id: SYNTH_USER_A, university_id: SYNTH_UNI_A };
    const evaluationB = { student_id: SYNTH_USER_B, university_id: SYNTH_UNI_B };
    const reviewer = makeRequester({ roles: ['reviewer'], universityId: SYNTH_UNI_A });
    const student = makeRequester({ roles: ['student'], userId: SYNTH_USER_A, universityId: SYNTH_UNI_A });
    assert.doesNotThrow(() => access.assertCanDownloadEvaluation(reviewer, evaluationA));
    assert.doesNotThrow(() => access.assertCanDownloadEvaluation(student, evaluationA));
    assert.throws(
      () => access.assertCanDownloadEvaluation(student, evaluationB),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    const outsider = makeRequester({ roles: ['student'], userId: SYNTH_USER_B, universityId: SYNTH_UNI_A });
    assert.throws(
      () => access.assertCanDownloadEvaluation(outsider, evaluationA),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('reuses a stored PDF on repeated approval and regenerates only when asked', () => {
    const previous = {
      id: 'eval-1',
      pdf_file_id: 'file-1',
      final_status: 'PASSED',
      score_evidence_json: {
        sourceHash: 'same-source',
        sourceTemplateFileId: 'template-file-1',
        fidelity: { mediaPreserved: true },
        generatedPageCount: 2,
        templatePayload: {
          student_name: 'محمد أحمد الطراونة',
          student_number: '2020123456',
          student_specialty: 'الأمن السيبراني',
          training_start_date: '23 / 7 / 2026',
          training_end_date: '5 / 9 / 2026',
        },
      },
    };
    assert.equal(
      shouldReuseStoredPdf(previous, { regenerate: false, sourceHash: 'same-source' }),
      true
    );
    assert.equal(
      shouldReuseStoredPdf(previous, { regenerate: true, sourceHash: 'same-source' }),
      false
    );
    assert.equal(
      shouldReuseStoredPdf(
        { ...previous, pdf_file_id: null },
        { regenerate: false, sourceHash: 'same-source' }
      ),
      false
    );
    assert.equal(
      shouldReuseStoredPdf(previous, { regenerate: false, sourceHash: 'changed-source' }),
      false
    );
  });
});

describe('official PDF page count', () => {
  it('converts the filled Mutah form to a two-page PDF when LibreOffice is available', async (t) => {
    const soffice = findSoffice();
    if (!soffice) {
      t.skip('LibreOffice is not installed in this environment');
      return;
    }
    const payload = samplePayload();
    const filled = await fillDocxTemplate(fs.readFileSync(officialTemplatePath()), buildPlaceholderMap(payload));
    const pdf = await convertFilledDocxToPdf(filled);
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(pdf);
    assert.equal(parsed.numpages, 2);
  });
});
