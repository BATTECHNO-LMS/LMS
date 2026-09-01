'use strict';

const crypto = require('crypto');
const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const scoring = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');
const {
  buildFieldTrainingEligibilityReasons,
  reportEligibilityStatus,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');
const {
  missingFieldEntries,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const {
  preflightEvaluationTemplate,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.preflight');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function officialState(ctx, calculated) {
  const stored = ctx.application?.completion_eligibility_status;
  const eligibilityStatus = stored
    ? reportEligibilityStatus(ctx.application)
    : (calculated.eligibilityReasons || []).filter(
          (code) => code !== 'PROFESSIONAL_EVALUATION_INCOMPLETE'
        ).length
      ? 'NOT_ELIGIBLE'
      : 'ELIGIBLE';
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
  return {
    eligibilityStatus,
    reasons,
    comment: buildAutoComment(
      { ...calculated, eligibilityStatus, eligibilityReasonLabels: reasons.labelsAr },
      { eligibilityStatus, reasonLabels: reasons.labelsAr }
    ),
  };
}

async function main() {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: OPPORTUNITY_ID },
    include: {
      evaluation_template: true,
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        include: { universities: { select: { id: true, name: true } } },
      },
    },
  });
  if (!opportunity) throw new Error('Mutah opportunity not found');

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  });
  const { byId } = await service.loadBatchContext(apps.map((row) => row.id));
  const evaluations = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    select: {
      application_id: true,
      template_id: true,
      template_version: true,
      pdf_file_id: true,
      score_evidence_json: true,
    },
  });
  const evaluationByApp = new Map(evaluations.map((row) => [row.application_id, row]));

  const missingRows = [];
  const readyStudents = [];
  const statusCounts = { READY: 0, MISSING_DATA: 0, ELIGIBLE: 0, NOT_ELIGIBLE: 0 };
  let currentVerifiedArtifacts = 0;
  let outdatedOrLegacyArtifacts = 0;

  for (const app of apps) {
    const ctx = byId.get(app.id);
    if (!ctx) continue;
    const policy = { ...ctx.policy };
    if (policy.requiredTrainingHours == null) {
      policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
    }
    const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
    const official = officialState(ctx, calculated);
    const evaluationDate = new Date('2026-09-01T00:00:00.000Z');
    const payload = service.buildFillFields(
      ctx,
      {
        ...calculated,
        eligibilityStatus: official.eligibilityStatus,
        eligibilityReasons: official.reasons.codes,
        eligibilityReasonLabels: official.reasons.labelsAr,
        generalComments: official.comment,
        autoComment: official.comment,
        evaluationDate,
        fieldSupervisorDate: evaluationDate,
        academicSupervisorDate: evaluationDate,
      },
      opportunity.evaluation_template
    );
    const missing = missingFieldEntries(payload);
    if (missing.length) {
      statusCounts.MISSING_DATA += 1;
      for (const item of missing) {
        missingRows.push({
          studentName: payload.student_name,
          universityNumber: payload.student_number,
          applicationId: app.id,
          missingField: item.labelAr,
          missingCode: item.code,
        });
      }
    } else {
      statusCounts.READY += 1;
      readyStudents.push({
        studentName: payload.student_name,
        universityNumber: payload.student_number,
        applicationId: app.id,
      });
    }
    statusCounts[official.eligibilityStatus] += 1;

    const generated = evaluationByApp.get(app.id);
    if (generated?.pdf_file_id) {
      const sourceId = generated.score_evidence_json?.sourceTemplateFileId;
      if (
        generated.template_id === opportunity.evaluation_template_id &&
        Number(generated.template_version) === Number(opportunity.evaluation_template?.version) &&
        sourceId === opportunity.evaluation_template?.original_file_id &&
        generated.score_evidence_json?.fidelity &&
        Number(generated.score_evidence_json?.generatedPageCount) === 2
      ) {
        currentVerifiedArtifacts += 1;
      } else {
        outdatedOrLegacyArtifacts += 1;
      }
    }
  }

  let template = null;
  if (opportunity.evaluation_template?.original_file_id) {
    const file = await prisma.files.findFirst({
      where: { id: opportunity.evaluation_template.original_file_id, deleted_at: null },
    });
    if (file) {
      const buffer = await getProvider().getObjectBuffer(file.storage_key);
      template = {
        id: opportunity.evaluation_template.id,
        version: opportunity.evaluation_template.version,
        sourceTemplateFileId: file.id,
        sourceTemplateFileName: file.original_name,
        sourceTemplateSha256: hash(buffer),
        preflight: await preflightEvaluationTemplate(buffer, {
          requireStamp: true,
          requireSignature: true,
        }),
      };
    }
  }

  const groupedMissing = {};
  const missingByStudent = new Map();
  for (const row of missingRows) {
    groupedMissing[row.missingCode] = (groupedMissing[row.missingCode] || 0) + 1;
    const current = missingByStudent.get(row.applicationId) || {
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      applicationId: row.applicationId,
      missingFields: [],
      missingCodes: [],
    };
    current.missingFields.push(row.missingField);
    current.missingCodes.push(row.missingCode);
    missingByStudent.set(row.applicationId, current);
  }
  console.log(
    JSON.stringify(
      {
        opportunity: {
          id: opportunity.id,
          title: opportunity.title,
          universityId:
            opportunity.university_id ||
            opportunity.field_training_opportunity_eligibility?.[0]?.university_id,
          universityName:
            opportunity.universities?.name ||
            opportunity.field_training_opportunity_eligibility?.[0]?.universities?.name,
          organizationName: opportunity.organization_name,
          hostOrganization: opportunity.host_organization,
          startDate: opportunity.start_date,
          endDate: opportunity.end_date,
          requiredHours: opportunity.required_training_hours,
        },
        template,
        approvedStudents: apps.length,
        statusCounts,
        generatedArtifacts: {
          currentVerifiedArtifacts,
          outdatedOrLegacyArtifacts,
          totalWithPdf: evaluations.filter((row) => row.pdf_file_id).length,
        },
        groupedMissing,
        readyStudents,
        missingStudents: [...missingByStudent.values()],
      },
      null,
      2
    )
  );
  console.log('MISSING_TABLE_START');
  console.log('| Student Name | University Number | Missing Field | Existing Source Checked | Action Needed |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const row of [...missingByStudent.values()].sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'ar')
  )) {
    const safe = (value) => String(value || '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    console.log(
      `| ${safe(row.studentName)} | ${safe(row.universityNumber)} | ${safe(row.missingFields.join('؛ '))} | ` +
        `ملف الطالب؛ سجل الحضور والساعات؛ بيانات الفرصة والمؤسسة؛ اسم المشرف الأكاديمي؛ التقييم المهني | ` +
        `استكمال الحقول المحددة في فحص الجاهزية |`
    );
  }
  console.log('MISSING_TABLE_END');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
