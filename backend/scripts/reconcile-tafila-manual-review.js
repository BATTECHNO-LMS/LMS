'use strict';

/**
 * Dry-run / apply Tafila AUTHORIZED_MANUAL_REVIEW reconciliation.
 *
 *   node scripts/reconcile-tafila-manual-review.js
 *   node scripts/reconcile-tafila-manual-review.js --apply
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const approvedSvc = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');
const { LAITH_UNIVERSITY_NUMBER } = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

const APPLY = process.argv.includes('--apply');

async function main() {
  const laithGrades = await approvedSvc.applyLaithAuthorizedTaskGrades({
    dryRun: !APPLY,
    actorUserId: null,
  });

  let plan;
  if (APPLY) {
    plan = await approvedSvc.buildReconciliationPlan({ afterLaithGrades: true });
  } else {
    plan = await approvedSvc.buildReconciliationPlan({ afterLaithGrades: false });
    plan.laithGradePreview = laithGrades;
    // Soft-skip laith task raw validations until grades applied.
    plan.validations = plan.validations.filter(
      (v) => !String(v.name).startsWith('laith_task') && v.name !== 'laith_final_numeric_below_80'
    );
    plan.validations.push({ name: 'laith_grade_plan_ready', ok: Boolean(laithGrades.ok) });
    // For dry-run, still validate laith numeric using planned behavior overlay.
    const laith = plan.rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER);
    plan.validations.push({
      name: 'laith_final_numeric_below_80_planned',
      ok: laith && laith.finalApprovedScore != null && Number(laith.finalApprovedScore) < 80,
    });
    plan.validations.push({
      name: 'laith_not_eligible_planned',
      ok: laith && laith.finalApprovedStatus === 'NOT_ELIGIBLE',
    });
    plan.validationPassed = plan.validations.every((v) => v.ok);
  }

  const summary = {
    apply: APPLY,
    opportunityId: plan.opportunityId,
    lmsStudents: plan.lmsStudents,
    baselineMappings: plan.baselineMappings,
    matched: plan.matched,
    missing: plan.missing,
    historicalEligible: plan.historicalEligible,
    historicalNotEligible: plan.historicalNotEligible,
    taskEvaluationsCorrected: plan.taskEvaluationsCorrected,
    eligibleBelow80After: plan.eligibleBelow80After,
    eligibleNullAfter: plan.eligibleNullAfter,
    breakdownMismatch: plan.breakdownMismatch,
    eligibleWithFailureReasons: plan.eligibleWithFailureReasons,
    finalEligible: plan.finalEligible,
    finalNotEligible: plan.finalNotEligible,
    laithGrades,
    laith: plan.rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER) || null,
    laithBehavior: plan.laithBehavior,
    correctedSample: (plan.taskCorrectedStudents || []).slice(0, 30).map((r) => ({
      studentName: r.studentName,
      universityNumber: r.universityNumber,
      excelScore: r.excelScore,
      oldStatus: r.currentLmsStatus,
      oldScore: r.currentLmsScore,
      rawTaskPoints: r.rawTaskData?.points ?? r.recalculatedScore,
      correctedTaskPoints: r.scoreBreakdown?.taskPoints,
      newFinalScore: r.finalApprovedScore,
      finalStatus: r.finalApprovedStatus,
      source: r.approvedEvaluationResult?.source,
    })),
    students: plan.rows.map((r) => ({
      studentName: r.studentName,
      universityNumber: r.universityNumber,
      oldApprovedStatus: r.excelStatus,
      oldApprovedScore: r.excelScore,
      currentScore: r.currentLmsScore,
      currentStatus: r.currentLmsStatus,
      currentTaskComponent: r.rawTaskData?.points ?? null,
      correctedTaskComponent: r.scoreBreakdown?.taskPoints ?? null,
      newFinalScore: r.finalApprovedScore,
      finalStatus: r.finalApprovedStatus,
      source: r.approvedEvaluationResult?.source,
      changeReason: r.changeReason,
      breakdown: r.scoreBreakdown,
    })),
    validations: plan.validations,
    validationPassed: plan.validationPassed,
  };

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_MANUAL_REVIEW_RECONCILIATION_DRY_RUN.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  if (APPLY) {
    if (!plan.validationPassed) {
      console.error(JSON.stringify(plan.validations.filter((v) => !v.ok), null, 2));
      throw new Error('Refusing to persist: validation failed');
    }
    const result = await approvedSvc.applyReconciliationPlan(plan, { actorUserId: null });
    summary.persisted = result.persisted;
    summary.appliedAt = new Date().toISOString();
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        apply: summary.apply,
        validationPassed: summary.validationPassed,
        failedValidations: summary.validations.filter((v) => !v.ok),
        lmsStudents: summary.lmsStudents,
        historicalEligible: summary.historicalEligible,
        historicalNotEligible: summary.historicalNotEligible,
        taskEvaluationsCorrected: summary.taskEvaluationsCorrected,
        eligibleBelow80After: summary.eligibleBelow80After,
        eligibleNullAfter: summary.eligibleNullAfter,
        breakdownMismatch: summary.breakdownMismatch,
        eligibleWithFailureReasons: summary.eligibleWithFailureReasons,
        finalEligible: summary.finalEligible,
        finalNotEligible: summary.finalNotEligible,
        laith: summary.laith && {
          universityNumber: summary.laith.universityNumber,
          finalApprovedScore: summary.laith.finalApprovedScore,
          finalApprovedStatus: summary.laith.finalApprovedStatus,
          breakdown: summary.laith.scoreBreakdown,
        },
        correctedSample: summary.correctedSample,
        persisted: summary.persisted || null,
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
    await prisma.$disconnect();
  });
