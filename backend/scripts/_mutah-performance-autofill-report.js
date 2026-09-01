'use strict';

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const scoring = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');
const readinessMod = require('../src/modules/fieldTraining/fieldTrainingEvaluation.readiness');
const { missingFieldEntries } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');
const { buildFieldTrainingEligibilityReasons, reportEligibilityStatus } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');
const { GATE_REASONS } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');

const OPPORTUNITY_ID = process.argv[2] || '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const OMAR_NUMBER = '120232222080';

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    select: { id: true, student_id: true },
  });
  const { byId } = await service.loadBatchContext(apps.map((row) => row.id));
  const students = [];
  for (const app of apps) {
    const ctx = byId.get(app.id);
    if (!ctx) continue;
    const policy = { ...ctx.policy };
    if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
    const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
    const payload = service.buildFillFields(ctx, {
      ...calculated,
      eligibilityStatus: ctx.application.completion_eligibility_status || calculated.eligibilityStatus,
      generalComments: buildAutoComment(calculated),
    });
    const missing = missingFieldEntries(payload);
    const readinessInfo = readinessMod.classifyEvaluationReadiness({
      missingFieldEntries: missing,
      criterionEvidence: calculated.criterionEvidence,
      usesManualRating: calculated.usesManualRating,
    });
    students.push({
      applicationId: app.id,
      studentName: payload.student_name,
      universityNumber: payload.student_number,
      readinessCategory: readinessInfo.readinessCategory,
      hours: payload.training_hours_display,
      professionalTotal: calculated.professionalTotal,
      missing,
      missingProfessional: readinessMod.missingProfessionalCriteria(calculated.criterionEvidence),
      criteria: calculated.criterionEvidence,
    });
  }
  const omar = students.find((row) => row.universityNumber === OMAR_NUMBER);
  console.log(JSON.stringify({
    opportunityId: OPPORTUNITY_ID,
    total: students.length,
    readyAutomatic: students.filter((s) => s.readinessCategory === 'READY_AUTOMATIC').length,
    readyWithManual: students.filter((s) => s.readinessCategory === 'READY_WITH_MANUAL_RATING').length,
    missingStatic: students.filter((s) => s.readinessCategory === 'MISSING_STATIC_DATA').length,
    missingProfessional: students.filter((s) => s.readinessCategory === 'MISSING_PROFESSIONAL_EVIDENCE').length,
    omar,
    manualNeeded: students
      .filter((s) => s.readinessCategory === 'MISSING_PROFESSIONAL_EVIDENCE')
      .slice(0, 15)
      .map((s) => ({
        name: s.studentName,
        number: s.universityNumber,
        missing: s.missingProfessional,
      })),
    staticNeeded: students
      .filter((s) => s.readinessCategory === 'MISSING_STATIC_DATA')
      .slice(0, 15)
      .map((s) => ({
        name: s.studentName,
        number: s.universityNumber,
        missing: s.missing.map((m) => m.code),
      })),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
