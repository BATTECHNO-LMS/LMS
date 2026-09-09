'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');
const { fillDocxTemplate, inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { buildPlaceholderMap } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');
const { buildFieldTrainingEvaluationTemplatePayload } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const {
  countBidiVisual,
  scoreGridHeaderCells,
  cellPlainText,
  ratingColumnIndexForScore,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { buildEvaluationDocxFilename } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.filename');

const OUT_DIR = path.join(__dirname, '../tmp/mutah-word-qa');

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
      criterion1Score: 1,
      criterion2Score: 2,
      criterion3Score: 3,
      criterion4Score: 4,
      criterion5Score: 5,
      criterion6Score: 5,
      criterion7Score: 5,
      criterion8Score: 5,
      criterion9Score: 5,
      criterion10Score: 5,
      professionalTotal: 40,
      eligibilityStatus: 'ELIGIBLE',
      generalComments: 'حالة الطالب: مؤهل',
      evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}

async function inspectScoreGrid(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const scoreTable = [...documentXml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
  const headers = scoreGridHeaderCells(scoreTable);
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  return {
    bidiVisual: countBidiVisual(scoreTable),
    headers,
    mediaCount: media.length,
    lastRenderedPageBreaks: (documentXml.match(/w:lastRenderedPageBreak/g) || []).length,
    tblPrHasBidiVisual: /w:bidiVisual/.test(scoreTable),
    headerXmlOrder: headers,
    hasStyles: Boolean(zip.file('word/styles.xml')),
    hasSettings: Boolean(zip.file('word/settings.xml')),
  };
}

async function inspectSource() {
  const template = fs.readFileSync(officialTemplatePath());
  const zip = await JSZip.loadAsync(template);
  const documentXml = await zip.file('word/document.xml').async('string');
  const scoreTable = [...documentXml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  return {
    lastRenderedPageBreaks: (documentXml.match(/w:lastRenderedPageBreak/g) || []).length,
    pageCount: (documentXml.match(/w:lastRenderedPageBreak/g) || []).length + 1,
    bidiVisual: countBidiVisual(scoreTable),
    headers: scoreGridHeaderCells(scoreTable),
    mediaCount: media.length,
    tblpPr: /w:tblpPr/.test(scoreTable || ''),
  };
}

async function writeSample(label, ctx) {
  const template = fs.readFileSync(officialTemplatePath());
  const payload = buildFieldTrainingEvaluationTemplatePayload(ctx);
  const filled = await fillDocxTemplate(Buffer.from(template), buildPlaceholderMap(payload));
  const filename = buildEvaluationDocxFilename({
    studentName: payload.student_name,
    universityNumber: payload.student_number,
  });
  const outPath = path.join(OUT_DIR, filename || `${label}.docx`);
  fs.writeFileSync(outPath, filled);
  const inspect = await inspectFilledDocx(filled);
  const grid = await inspectScoreGrid(filled);
  return {
    label,
    filename,
    outPath,
    checkmarks: inspect.checkmarks,
    stamp: inspect.hasOfficialStamp,
    signatures: inspect.hasSignatures,
    media: inspect.media.length,
    bidiVisual: grid.bidiVisual,
    pageCount: inspect.pageCount,
    lastRenderedPageBreaks: inspect.lastRenderedPageBreaks,
    headers: grid.headers,
    score1Col: ratingColumnIndexForScore(grid.headers, 1),
    score5Col: ratingColumnIndexForScore(grid.headers, 5),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const source = await inspectSource();
  const samples = [
    await writeSample(
      'c1-c5-rtl',
      eligibleCtx({
        evaluation: {
          criterion1Score: 1,
          criterion2Score: 2,
          criterion3Score: 3,
          criterion4Score: 4,
          criterion5Score: 5,
          criterion6Score: 5,
          criterion7Score: 5,
          criterion8Score: 5,
          criterion9Score: 5,
          criterion10Score: 5,
          professionalTotal: 40,
          eligibilityStatus: 'ELIGIBLE',
          generalComments: 'حالة الطالب: مؤهل',
          evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      })
    ),
    await writeSample('arabic-eligible', eligibleCtx()),
    await writeSample(
      'not-eligible',
      eligibleCtx({
        student: {
          full_name: 'عمر محمد ثلجي المواجده',
          university_student_number: '120232222080',
          university_specialty: { name_ar: 'علم البيانات والذكاء الاصطناعي' },
        },
        application: {
          completed_training_hours: 10,
          attendance_percentage: 72,
          completion_eligibility_status: 'ineligible',
          academic_supervisor_name: 'أ.د. احمد الحسنات',
        },
        evaluation: {
          criterion1Score: 3,
          criterion2Score: 2,
          criterion3Score: null,
          criterion4Score: null,
          criterion5Score: 2,
          criterion6Score: null,
          criterion7Score: null,
          criterion8Score: null,
          criterion9Score: 2,
          criterion10Score: null,
          professionalTotal: null,
          eligibilityStatus: 'NOT_ELIGIBLE',
          generalComments:
            'حالة الطالب: غير مؤهل\n\nأسباب عدم التأهيل:\n- لم يستكمل الساعات التدريبية المطلوبة (10 من أصل 140 ساعة).',
          evaluationDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      })
    ),
  ];
  const failed = samples.filter(
    (row) => row.pageCount !== 2 || row.bidiVisual !== 0 || row.media < 4 || !row.stamp || !row.signatures
  );
  const out = {
    source,
    samples,
    acceptance: {
      sourcePages: source.pageCount,
      generatedPages: samples.map((row) => row.pageCount),
      extraThirdPage: samples.some((row) => row.pageCount > 2),
      sourceRtlPreserved: samples.every((row) => row.bidiVisual === 0 && source.bidiVisual === 0),
      stamp: samples.every((row) => row.stamp),
      signed: samples.every((row) => row.signatures),
    },
  };
  console.log(JSON.stringify(out, null, 2));
  if (source.pageCount !== 2 || failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
