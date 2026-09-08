'use strict';

const { prisma } = require('../../config/db');
const {
  FINAL_STATUS,
  TAFILA_POLICY_CODE,
  TAFILA_SCORING_RULES,
} = require('./fieldTrainingEvaluation.constants');
const qualification = require('./fieldTraining.qualification');
const scoring = require('./fieldTrainingEvaluation.scoring');

const persisting = new Set();

function num(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function evalService() {
  return require('./fieldTrainingEvaluation.service');
}

function workflowMod() {
  return require('./fieldTraining.workflow');
}

function serializeScoreComponents(components = {}) {
  return {
    attendance: {
      rawPercentage: components.attendance?.rawPercentage ?? null,
      effectivePercentage:
        components.attendance?.effectivePercentage ?? components.attendance?.rawPercentage ?? null,
      recordedAttendancePercentage:
        components.attendance?.recordedAttendancePercentage ??
        components.attendance?.rawPercentage ??
        null,
      evaluationAttendancePercentage:
        components.attendance?.evaluationAttendancePercentage ??
        components.attendance?.effectivePercentage ??
        components.attendance?.rawPercentage ??
        null,
      points: components.attendance?.points ?? null,
      maxPoints: components.attendance?.maxPoints ?? 20,
    },
    postAssessment: {
      rawPercentage: components.postAssessment?.rawPercentage ?? null,
      effectivePercentage:
        components.postAssessment?.effectivePercentage ??
        components.postAssessment?.rawPercentage ??
        null,
      points: components.postAssessment?.points ?? null,
      maxPoints: components.postAssessment?.maxPoints ?? 20,
    },
    tasks: {
      rawPercentage: components.tasks?.rawPercentage ?? null,
      effectivePercentage:
        components.tasks?.effectivePercentage ?? components.tasks?.rawPercentage ?? null,
      points: components.tasks?.points ?? null,
      maxPoints: components.tasks?.maxPoints ?? 40,
      acceptedCount: components.tasks?.acceptedCount ?? null,
      requiredCount: components.tasks?.requiredCount ?? null,
      submittedCount: components.tasks?.submittedCount ?? null,
      details: components.tasks?.details || [],
    },
    behavior: {
      rawPercentage: components.behavior?.rawPercentage ?? null,
      effectivePercentage:
        components.behavior?.effectivePercentage ?? components.behavior?.rawPercentage ?? null,
      points: components.behavior?.points ?? null,
      maxPoints: components.behavior?.maxPoints ?? 20,
      professionalTotal: components.behavior?.professionalTotal ?? null,
      professionalMax: components.behavior?.professionalMax ?? 50,
      rawProfessionalTotal: components.behavior?.rawProfessionalTotal ?? null,
    },
    finalScore: components.finalScore ?? null,
    rawFinalScore: components.rawFinalScore ?? null,
  };
}

function toPublicQualification(calculated) {
  if (!calculated) return null;
  return {
    finalScore: calculated.finalScore,
    scorePassed: Boolean(calculated.scorePassed),
    scoreStatus: calculated.scoreStatus || (calculated.finalScore == null ? 'INCOMPLETE' : 'COMPLETE'),
    eligibilityStatus: calculated.eligibilityStatus,
    workflowOutcome: calculated.workflowOutcome,
    eligibilityReasons: calculated.eligibilityReasons || [],
    eligibilityReasonLabels: calculated.eligibilityReasonLabels || [],
    mandatoryRequirements: calculated.mandatoryRequirements || {},
    scoreComponents: serializeScoreComponents(calculated.scoreComponents),
    policyCode: calculated.policy?.scoringRules?.code || null,
    passingScore: calculated.policy?.minimumPassingScore ?? null,
    weights: {
      attendance: calculated.policy?.attendanceWeight,
      postAssessment: calculated.policy?.postAssessmentWeight,
      tasks: calculated.policy?.tasksWeight,
      behavior: calculated.policy?.professionalEvaluationWeight,
    },
    zeroParticipationApplied: Boolean(calculated.zeroParticipationApplied),
    zeroParticipationPolicyCode: calculated.zeroParticipationPolicyCode || null,
    eligibilityOverride: calculated.eligibilityOverride || null,
    recordedAttendancePercent: calculated.recordedAttendancePercent ?? null,
    submittedRequiredTaskCount: calculated.submittedRequiredTaskCount ?? null,
  };
}

function enrichScoringInput(ctx) {
  const app = ctx.application || {};
  const storedHours = num(app.completed_training_hours);
  return {
    ...ctx.scoringInput,
    completedHours: storedHours != null ? storedHours : ctx.scoringInput?.completedHours,
    requiredTaskRows: qualification.buildRequiredTaskRows({
      tasks: ctx.tasks,
      submissions: ctx.submissions,
      studentId: app.student_id,
    }),
  };
}

function qualifyContext(ctx) {
  return qualification.qualifyLoadedContext(ctx);
}

async function calculateForApplications(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { byId } = await evalService().loadBatchContext(ids);
  return ids.map((id) => {
    const ctx = byId.get(id);
    const calculated = qualifyContext(ctx);
    return {
      applicationId: id,
      ctx,
      calculated,
      public: toPublicQualification(calculated),
    };
  });
}

async function calculateForApplication(applicationId) {
  const [row] = await calculateForApplications([applicationId]);
  return row;
}

function buildEligibilityDetails(calculated, ctx) {
  const components = serializeScoreComponents(calculated.scoreComponents);
  return {
    policyCode: calculated.policy?.scoringRules?.code || null,
    policyVersion: calculated.policy?.version || null,
    scoringModel: calculated.policy?.scoringRules?.model || null,
    finalScore: calculated.finalScore,
    scorePassed: calculated.scorePassed,
    scoreStatus: calculated.scoreStatus,
    passingScore: calculated.policy?.minimumPassingScore ?? 80,
    scoreComponents: components,
    mandatoryRequirements: calculated.mandatoryRequirements,
    attendance_percentage: calculated.attendancePercent ?? ctx?.scoringInput?.attendancePercentage ?? null,
    minimum_attendance_percentage:
      ctx?.opportunity?.minimum_attendance_percentage ?? calculated.policy?.minimumAttendancePercentage ?? null,
    training_hours: {
      completed_hours: ctx?.scoringInput?.completedHours ?? ctx?.application?.completed_training_hours ?? null,
      required_hours:
        ctx?.opportunity?.required_training_hours ?? calculated.policy?.requiredTrainingHours ?? null,
    },
    required_tasks: {
      accepted: components.tasks.acceptedCount,
      required: components.tasks.requiredCount,
    },
    pre_assessment_score: calculated.preAssessmentScore,
    post_assessment_score: calculated.postAssessmentScore,
    zeroParticipationApplied: Boolean(calculated.zeroParticipationApplied),
    zeroParticipationPolicyCode: calculated.zeroParticipationPolicyCode || null,
    eligibilityOverride: calculated.eligibilityOverride || null,
    recordedAttendancePercent: calculated.recordedAttendancePercent ?? null,
    submittedRequiredTaskCount: calculated.submittedRequiredTaskCount ?? null,
  };
}

function mapDbFinalStatus(calculated) {
  if (calculated.eligibilityStatus === 'ELIGIBLE' && calculated.scorePassed) {
    return FINAL_STATUS.PASSED;
  }
  if (calculated.finalScore != null && !calculated.scorePassed) {
    return FINAL_STATUS.FAILED;
  }
  return FINAL_STATUS.NOT_ELIGIBLE;
}

async function persistApplicationEligibility(applicationId, calculated, ctx) {
  const current = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    select: { training_status: true, eligibility_reason: true, opportunity_id: true },
  });
  const terminal = ['completed', 'expelled', 'failed'].includes(current?.training_status);
  let outcome = calculated.workflowOutcome;
  const details = buildEligibilityDetails(calculated, ctx);
  const { isPrimaryTafilaOpportunity } = require('./fieldTraining.tafilaApprovedBaseline');
  // Preserve approved cohort result across live recalculations.
  const prevApproved = current?.eligibility_reason?.details?.approvedEvaluationResult;
  const approved = calculated.approvedEvaluationResult || prevApproved || null;
  let labelsAr = calculated.eligibilityReasonLabels || [];
  let reasons = calculated.eligibilityReasons || [];

  if (approved && isPrimaryTafilaOpportunity(current?.opportunity_id)) {
    details.approvedEvaluationResult = approved;
    details.calculatedFinalScore = calculated.finalScore ?? null;
    details.displayFinalScore = approved.approvedFinalScore ?? null;
    details.finalScore = approved.approvedFinalScore ?? null;
    details.scorePassed =
      approved.approvedFinalScore != null &&
      Number(approved.approvedFinalScore) >= (details.passingScore ?? 80);
    outcome = approved.approvedStatus === 'ELIGIBLE' ? 'eligible' : 'ineligible';
    // Live recalculation must not replace approved Arabic reasons/status.
    if (
      !calculated.approvedEvaluationResult &&
      Array.isArray(current?.eligibility_reason?.labelsAr) &&
      current.eligibility_reason.labelsAr.length
    ) {
      labelsAr = current.eligibility_reason.labelsAr;
      reasons = Array.isArray(current.eligibility_reason.reasons)
        ? current.eligibility_reason.reasons
        : reasons;
    }
  } else if (calculated.approvedEvaluationResult) {
    details.approvedEvaluationResult = calculated.approvedEvaluationResult;
    details.calculatedFinalScore = calculated.finalScore ?? null;
    details.displayFinalScore = calculated.approvedEvaluationResult.approvedFinalScore ?? null;
  }

  await prisma.field_training_applications.update({
    where: { id: applicationId },
    data: {
      completion_eligibility_status: outcome,
      eligibility_reason: {
        reasons,
        labelsAr,
        details,
      },
      ...(outcome === 'eligible' && !terminal ? { training_status: 'eligible_for_completion' } : {}),
      ...(outcome === 'ineligible' &&
      current?.training_status === 'eligible_for_completion' &&
      !terminal
        ? { training_status: 'in_training' }
        : {}),
    },
  });
}

function scalarEvaluationSnapshot(row) {
  return {
    university_id: row.university_id,
    opportunity_id: row.opportunity_id,
    application_id: row.application_id,
    student_id: row.student_id,
    template_id: row.template_id,
    template_version: row.template_version,
    source_template_file_id: row.source_template_file_id,
    policy_id: row.policy_id,
    policy_version: row.policy_version,
    eligibility_status: row.eligibility_status,
    final_status: row.final_status,
    eligibility_reasons: row.eligibility_reasons,
    attendance_component_score: row.attendance_component_score,
    tasks_component_score: row.tasks_component_score,
    post_assessment_component_score: row.post_assessment_component_score,
    professional_component_score: row.professional_component_score,
    pre_assessment_score: row.pre_assessment_score,
    post_assessment_score: row.post_assessment_score,
    improvement_percentage: row.improvement_percentage,
    criterion_1_score: row.criterion_1_score,
    criterion_2_score: row.criterion_2_score,
    criterion_3_score: row.criterion_3_score,
    criterion_4_score: row.criterion_4_score,
    criterion_5_score: row.criterion_5_score,
    criterion_6_score: row.criterion_6_score,
    criterion_7_score: row.criterion_7_score,
    criterion_8_score: row.criterion_8_score,
    criterion_9_score: row.criterion_9_score,
    criterion_10_score: row.criterion_10_score,
    professional_total: row.professional_total,
    professional_percentage: row.professional_percentage,
    final_score: row.final_score,
    final_percentage: row.final_percentage,
    auto_comment: row.auto_comment,
    general_comments: row.general_comments,
    comments_edited_by_id: row.comments_edited_by_id,
    comments_edited_at: row.comments_edited_at,
    score_evidence_json: row.score_evidence_json,
    pdf_file_id: row.pdf_file_id,
    filled_docx_file_id: row.filled_docx_file_id,
    is_current: false,
    version: row.version,
    supersedes_evaluation_id: row.supersedes_evaluation_id,
    regeneration_reason: row.regeneration_reason,
    generated_at: row.generated_at,
    generated_by_id: row.generated_by_id,
    finalized_at: row.finalized_at,
    finalized_by_id: row.finalized_by_id,
  };
}

async function snapshotCurrentEvaluation(applicationId, calculated, ctx) {
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true },
  });
  if (!current) return null;
  const policyCode = calculated.policy?.scoringRules?.code || TAFILA_POLICY_CODE;
  const evidence = {
    ...(current.score_evidence_json && typeof current.score_evidence_json === 'object'
      ? current.score_evidence_json
      : {}),
    qualification: toPublicQualification(calculated),
    policyCode,
    scoringModel: calculated.policy?.scoringRules?.model || null,
  };
  const reasons = (calculated.eligibilityReasons || []).map((code, index) => ({
    code,
    text: (calculated.eligibilityReasonLabels || [])[index] || code,
  }));
  await prisma.$transaction(async (tx) => {
    await tx.field_training_final_evaluations.create({
      data: scalarEvaluationSnapshot(current),
    });
    await tx.field_training_final_evaluations.update({
      where: { id: current.id },
      data: {
        policy_id: calculated.policy?.id || current.policy_id,
        policy_version: calculated.policy?.version || current.policy_version,
        eligibility_status: calculated.eligibilityStatus,
        final_status: mapDbFinalStatus(calculated),
        eligibility_reasons: reasons,
        attendance_component_score: calculated.attendanceComponentScore,
        tasks_component_score: calculated.tasksComponentScore,
        post_assessment_component_score: calculated.postAssessmentComponentScore,
        professional_component_score: calculated.professionalComponentScore,
        pre_assessment_score: calculated.preAssessmentScore,
        post_assessment_score: calculated.postAssessmentScore,
        improvement_percentage: calculated.improvementPercentage,
        criterion_1_score: calculated.criterion1Score,
        criterion_2_score: calculated.criterion2Score,
        criterion_3_score: calculated.criterion3Score,
        criterion_4_score: calculated.criterion4Score,
        criterion_5_score: calculated.criterion5Score,
        criterion_6_score: calculated.criterion6Score,
        criterion_7_score: calculated.criterion7Score,
        criterion_8_score: calculated.criterion8Score,
        criterion_9_score: calculated.criterion9Score,
        criterion_10_score: calculated.criterion10Score,
        professional_total: calculated.professionalTotal,
        professional_percentage: calculated.professionalPercentage,
        final_score: calculated.finalScore,
        final_percentage: calculated.finalPercentage,
        score_evidence_json: evidence,
        version: (current.version || 1) + 1,
        regeneration_reason: policyCode,
        updated_at: new Date(),
      },
    });
  });
  return current.id;
}

async function persistLegacyEligibility(applicationId) {
  const result = await workflowMod().calculateLegacyFieldTrainingEligibility(applicationId);
  const statusMap = {
    eligible: 'eligible',
    ineligible: 'ineligible',
    needs_review: 'needs_review',
  };
  const current = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    select: { training_status: true },
  });
  const terminal = ['completed', 'expelled', 'failed'].includes(current?.training_status);
  await prisma.field_training_applications.update({
    where: { id: applicationId },
    data: {
      completion_eligibility_status: statusMap[result.outcome],
      eligibility_reason: { reasons: result.reasons, details: result.details },
      ...(result.outcome === 'eligible' && !terminal
        ? { training_status: 'eligible_for_completion' }
        : {}),
    },
  });
  return result;
}

async function persistQualification(applicationId, { snapshotEvaluation = true } = {}) {
  if (!applicationId) {
    return { outcome: 'ineligible', reasons: ['application_not_found'], details: {} };
  }
  if (persisting.has(applicationId)) {
    return { outcome: 'needs_review', reasons: ['persist_in_progress'], details: {} };
  }
  persisting.add(applicationId);
  try {
    const row = await calculateForApplication(applicationId);
    if (!row?.ctx) {
      return { outcome: 'ineligible', reasons: ['application_not_found'], details: {} };
    }
    if (!qualification.isFixedComponentPolicy(row.ctx.policy)) {
      return persistLegacyEligibility(applicationId);
    }
    await persistApplicationEligibility(applicationId, row.calculated, row.ctx);
    if (snapshotEvaluation) {
      await snapshotCurrentEvaluation(applicationId, row.calculated, row.ctx);
    }
    return {
      outcome: row.calculated.workflowOutcome,
      reasons: row.calculated.eligibilityReasons || [],
      details: buildEligibilityDetails(row.calculated, row.ctx),
      qualification: toPublicQualification(row.calculated),
    };
  } finally {
    persisting.delete(applicationId);
  }
}

async function calculateEligibilityOutcome(applicationId) {
  const row = await calculateForApplication(applicationId);
  if (!row?.ctx) {
    return { outcome: 'ineligible', reasons: ['application_not_found'], details: {} };
  }
  if (!qualification.isFixedComponentPolicy(row.ctx.policy)) {
    return workflowMod().calculateLegacyFieldTrainingEligibility(applicationId);
  }
  return {
    outcome: row.calculated.workflowOutcome,
    reasons: row.calculated.eligibilityReasons || [],
    details: buildEligibilityDetails(row.calculated, row.ctx),
    qualification: toPublicQualification(row.calculated),
  };
}

async function persistMany(applicationIds, options = {}) {
  const results = [];
  for (const id of applicationIds) {
    results.push(await persistQualification(id, options));
  }
  return results;
}

async function upsertUniversityPolicy(universityId, mapped, scoringRules, actorUserId = null) {
  const check = scoring.validatePolicyWeights(mapped);
  if (!check.ok) {
    const err = new Error('POLICY_WEIGHTS_INVALID');
    err.total = check.total;
    throw err;
  }
  const current = await prisma.field_training_evaluation_policies.findFirst({
    where: { university_id: universityId, is_active: true, archived_at: null },
  });
  return prisma.$transaction(async (tx) => {
    if (current) {
      await tx.field_training_evaluation_policies.update({
        where: { id: current.id },
        data: { is_active: false, archived_at: new Date(), updated_at: new Date() },
      });
    }
    return tx.field_training_evaluation_policies.create({
      data: {
        university_id: universityId,
        version: (current?.version || 0) + 1,
        is_active: true,
        minimum_attendance_percentage: mapped.minimumAttendancePercentage,
        required_training_hours: mapped.requiredTrainingHours,
        required_tasks_required: mapped.requiredTasksRequired,
        post_assessment_required: mapped.postAssessmentRequired,
        professional_evaluation_required: mapped.professionalEvaluationRequired,
        minimum_passing_score: mapped.minimumPassingScore,
        attendance_weight: mapped.attendanceWeight,
        tasks_weight: mapped.tasksWeight,
        post_assessment_weight: mapped.postAssessmentWeight,
        professional_evaluation_weight: mapped.professionalEvaluationWeight,
        attendance_bands: mapped.attendanceBands,
        scoring_rules: scoringRules,
        created_by_id: actorUserId,
      },
    });
  });
}

async function ensureTafilaPolicy(universityId, actorUserId = null) {
  const mapped = scoring.normalizePolicy({
    minimumAttendancePercentage: 80,
    requiredTrainingHours: 140,
    requiredTasksRequired: true,
    postAssessmentRequired: true,
    professionalEvaluationRequired: true,
    minimumPassingScore: 80,
    attendanceWeight: 20,
    tasksWeight: 40,
    postAssessmentWeight: 20,
    professionalEvaluationWeight: 20,
    scoringRules: TAFILA_SCORING_RULES,
  });
  return upsertUniversityPolicy(universityId, mapped, TAFILA_SCORING_RULES, actorUserId);
}

module.exports = {
  toPublicQualification,
  qualifyContext,
  enrichScoringInput,
  calculateForApplication,
  calculateForApplications,
  calculateEligibilityOutcome,
  persistQualification,
  persistMany,
  persistApplicationEligibility,
  buildEligibilityDetails,
  snapshotCurrentEvaluation,
  ensureTafilaPolicy,
  upsertUniversityPolicy,
  TAFILA_POLICY_CODE,
};
