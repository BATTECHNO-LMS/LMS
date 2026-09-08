'use strict';

/**
 * Dry-run / apply Tafila submitted-task 80–90 normalization.
 *
 *   node scripts/reconcile-tafila-task-normalization.js
 *   node scripts/reconcile-tafila-task-normalization.js --apply
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
    plan.validations = plan.validations.filter(
      (v) => !String(v.name).startsWith('laith_task') && v.name !== 'laith_final_numeric_below_80'
    );
    plan.validations.push({ name: 'laith_grade_plan_ready', ok: Boolean(laithGrades.ok) });
    const laith = plan.rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER);
    plan.validations.push({
      name: 'laith_final_numeric_below_80_planned',
      ok: laith && laith.finalApprovedScore != null && Number(laith.finalApprovedScore) < 80,
    });
    plan.validationPassed = plan.validations.every((v) => v.ok);
  }

  let submittedTasksCorrected = 0;
  const taskAudit = [];
  for (const row of plan.rows) {
    if (row.finalApprovedStatus !== 'ELIGIBLE') continue;
    const details = row.approvedEvaluationResult?.approvedTaskEvaluation?.details || [];
    for (const d of details) {
      if (d.submissionStatus !== 'SUBMITTED') continue;
      submittedTasksCorrected += 1;
      taskAudit.push({
        studentName: row.studentName,
        universityNumber: row.universityNumber,
        task: d.title,
        submissionStatus: d.submissionStatus,
        rawScore: d.rawTaskScore,
        approvedScore: d.approvedTaskScore,
        oldTaskComponent: row.rawTaskData?.oldTaskComponent ?? row.rawTaskData?.points ?? null,
        newTaskComponent: row.scoreBreakdown?.taskPoints ?? null,
        oldFinalScore: row.currentLmsScore,
        newFinalScore: row.finalApprovedScore,
        eligibility: row.finalApprovedStatus,
      });
    }
    // Also include zero-submission legacy rows once
    if (!details.some((d) => d.submissionStatus === 'SUBMITTED')) {
      taskAudit.push({
        studentName: row.studentName,
        universityNumber: row.universityNumber,
        task: '(aggregate legacy component)',
        submissionStatus: '0_SUBMITTED',
        rawScore: null,
        approvedScore: null,
        oldTaskComponent: row.rawTaskData?.oldTaskComponent ?? row.rawTaskData?.points ?? null,
        newTaskComponent: row.scoreBreakdown?.taskPoints ?? null,
        oldFinalScore: row.currentLmsScore,
        newFinalScore: row.finalApprovedScore,
        eligibility: row.finalApprovedStatus,
        source: row.approvedEvaluationResult?.source,
      });
    }
  }

  const summary = {
    apply: APPLY,
    opportunityId: plan.opportunityId,
    lmsStudents: plan.lmsStudents,
    historicalEligible: plan.historicalEligible,
    historicalNotEligible: plan.historicalNotEligible,
    submittedTasksCorrected,
    approvedTaskScoreRange: '80-90',
    eligibleBelow80After: plan.eligibleBelow80After,
    eligibleNullAfter: plan.eligibleNullAfter,
    breakdownMismatch: plan.breakdownMismatch,
    eligibleWithFailureReasons: plan.eligibleWithFailureReasons,
    finalEligible: plan.finalEligible,
    finalNotEligible: plan.finalNotEligible,
    finalScoresRecalculated: plan.rows.length,
    laithGrades,
    laith: plan.rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER) || null,
    taskAudit,
    validations: plan.validations,
    validationPassed: plan.validationPassed,
  };

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_TASK_NORMALIZATION_DRY_RUN.json'
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
        submittedTasksCorrected: summary.submittedTasksCorrected,
        eligibleBelow80After: summary.eligibleBelow80After,
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
        taskAuditSample: summary.taskAudit.slice(0, 12),
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
