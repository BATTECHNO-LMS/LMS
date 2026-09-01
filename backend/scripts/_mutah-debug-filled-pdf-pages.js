'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pdfParse = require('pdf-parse');
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { convertDocxBufferWithLibreOffice, findSoffice } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.renderer');
const { fillDocxTemplate } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { buildPlaceholderMap } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');
const { getProvider } = require('../src/shared/storage/storageProvider');
const scoring = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');
const {
  buildFieldTrainingEligibilityReasons,
  reportEligibilityStatus,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');

async function renderPages(payload) {
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: '6c8783ec-49fd-428e-83e2-8b65e52c3b4f' },
    include: { evaluation_template: true },
  });
  const file = await prisma.files.findFirst({
    where: { id: opp.evaluation_template.original_file_id, deleted_at: null },
  });
  const buffer = await getProvider().getObjectBuffer(file.storage_key);
  const filled = await fillDocxTemplate(buffer, buildPlaceholderMap(payload));
  const pdf = await convertDocxBufferWithLibreOffice(filled, findSoffice());
  const parsed = await pdfParse(pdf);
  return parsed.numpages;
}

async function main() {
  const appId = process.argv[2] || 'f56fb447-af1e-4a00-9f43-27cdd1ca5274';
  const { byId } = await service.loadBatchContext([appId]);
  const ctx = byId.get(appId);
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: ctx.opportunity.id },
    include: { evaluation_template: true },
  });
  const policy = { ...ctx.policy, requiredTrainingHours: ctx.scoringInput.requiredHours };
  const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
  const eligibilityStatus = reportEligibilityStatus(ctx.application);
  const reasons = buildFieldTrainingEligibilityReasons({
    application: ctx.application,
    evidence: {
      attendancePercentage: ctx.scoringInput?.attendancePercentage,
      minimumAttendancePercentage: ctx.opportunity?.minimum_attendance_percentage,
      completedHours: ctx.scoringInput?.completedHours,
      requiredHours: ctx.scoringInput?.requiredHours,
      requiredTaskCount: ctx.scoringInput?.requiredTaskCount,
      acceptedTaskCount: ctx.scoringInput?.acceptedTaskCount,
    },
  });
  const comment = buildAutoComment(
    { ...calculated, eligibilityStatus, eligibilityReasonLabels: reasons.labelsAr },
    { eligibilityStatus, reasonLabels: reasons.labelsAr }
  );

  const basePayload = service.buildFillFields(
    ctx,
    {
      ...calculated,
      eligibilityStatus,
      eligibilityReasons: reasons.codes,
      eligibilityReasonLabels: reasons.labelsAr,
      generalComments: '',
      autoComment: '',
      evaluationDate: new Date(),
      fieldSupervisorDate: new Date(),
      academicSupervisorDate: new Date(),
    },
    opp.evaluation_template
  );

  const variants = [
    ['empty', ''],
    ['short', 'حالة الطالب: مؤهل'],
    ['single-line', 'حالة الطالب: مؤهل - أتم الطالب متطلبات التدريب الميداني.'],
    ['official', comment],
  ];
  const pages = {};
  for (const [key, text] of variants) {
    pages[key] = await renderPages({ ...basePayload, general_comments: text, autoComment: text });
  }

  console.log(
    JSON.stringify(
      {
        student: basePayload.student_name,
        eligibilityStatus,
        commentLength: comment.length,
        pages,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
