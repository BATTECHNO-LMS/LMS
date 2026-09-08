'use strict';

/**
 * Dry-run / apply Tafila approved Excel final reconciliation.
 *
 *   node scripts/reconcile-tafila-approved-excel.js
 *   node scripts/reconcile-tafila-approved-excel.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { prisma } = require('../src/config/db');
const approvedSvc = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');
const { LAITH_UNIVERSITY_NUMBER } = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

const APPLY = process.argv.includes('--apply');

async function main() {
  // Step H starts with Laith grade corrections (dry or apply).
  const laithGrades = await approvedSvc.applyLaithAuthorizedTaskGrades({
    dryRun: !APPLY,
    actorUserId: null,
  });

  // After applying grades (or simulating), build plan from current LMS calc.
  // If dry-run for Laith grades, temporarily we still calculate with CURRENT DB grades;
  // so for dry-run we report intended Laith grades separately and build plan after
  // a temporary in-memory note. For accurate Laith recalc in dry-run, apply grades
  // inside a transaction rollback is complex — instead apply grades first only when --apply,
  // and for dry-run compute plan then annotate Laith expected task component 16.2.
  let plan;
  if (APPLY) {
    plan = await approvedSvc.buildReconciliationPlan({ afterLaithGrades: true });
  } else {
    plan = await approvedSvc.buildReconciliationPlan({ afterLaithGrades: false });
    // Annotate expected Laith outcome after authorized grades.
    plan.laithGradePreview = laithGrades;
    plan.rows = plan.rows.map((row) => {
      if (row.universityNumber !== LAITH_UNIVERSITY_NUMBER) return row;
      return {
        ...row,
        note: 'Dry-run: Laith task grades 84/78 will be applied on --apply before final score persist',
        expectedTaskComponentAfterApply: 16.2,
      };
    });
    // Soft-validate Laith separately on dry-run (grades not yet written).
    plan.validations = plan.validations.filter(
      (v) => !String(v.name).startsWith('laith_task') && v.name !== 'laith_task_points_16_2'
    );
    plan.validations.push({
      name: 'laith_grade_plan_ready',
      ok: Boolean(laithGrades.ok),
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
    extraMapped: plan.extraMapped,
    eligibleGe80Preserved: plan.eligibleGe80Preserved,
    eligibleBelow80Found: plan.eligibleBelow80Found,
    eligibleBelow80RecalcToGe80: plan.eligibleBelow80RecalcToGe80,
    eligibleBelow80ChangedToNotEligible: plan.eligibleBelow80ChangedToNotEligible,
    eligibleBelow80After: plan.eligibleBelow80After,
    eligibleNullAfter: plan.eligibleNullAfter,
    finalEligible: plan.finalEligible,
    finalNotEligible: plan.finalNotEligible,
    laithGrades,
    laith: plan.rows.find((r) => r.universityNumber === LAITH_UNIVERSITY_NUMBER) || null,
    eligibleBelow80Students: plan.eligibleBelow80Students.map((r) => ({
      studentName: r.studentName,
      universityNumber: r.universityNumber,
      excelScore: r.excelScore,
      excelStatus: r.excelStatus,
      currentLmsScore: r.currentLmsScore,
      recalculatedScore: r.recalculatedScore,
      finalApprovedScore: r.finalApprovedScore,
      finalApprovedStatus: r.finalApprovedStatus,
      changeReason: r.changeReason,
      attendancePoints: r.attendancePoints,
      postPoints: r.postPoints,
      tasksPoints: r.tasksPoints,
      behaviorPoints: r.behaviorPoints,
    })),
    validations: plan.validations,
    validationPassed: plan.validationPassed,
    students: plan.rows.map((r) => ({
      studentName: r.studentName,
      universityNumber: r.universityNumber,
      excelScore: r.excelScore,
      excelStatus: r.excelStatus,
      currentLmsScore: r.currentLmsScore,
      currentLmsStatus: r.currentLmsStatus,
      recalculatedScore: r.needsRecalcBranch ? r.recalculatedScore : null,
      finalApprovedScore: r.finalApprovedScore,
      finalApprovedStatus: r.finalApprovedStatus,
      changeReason: r.changeReason,
      changeReasonAr: r.changeReasonAr,
    })),
  };

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_APPROVED_EXCEL_RECONCILIATION_DRY_RUN.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  if (APPLY) {
    if (!plan.validationPassed) {
      throw new Error('Refusing to persist: dry-run validation failed');
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
        validations: summary.validations,
        lmsStudents: summary.lmsStudents,
        baselineMappings: summary.baselineMappings,
        matched: summary.matched,
        missingCount: summary.missing.length,
        extraMappedCount: summary.extraMapped.length,
        eligibleGe80Preserved: summary.eligibleGe80Preserved,
        eligibleBelow80Found: summary.eligibleBelow80Found,
        eligibleBelow80RecalcToGe80: summary.eligibleBelow80RecalcToGe80,
        eligibleBelow80ChangedToNotEligible: summary.eligibleBelow80ChangedToNotEligible,
        eligibleBelow80After: summary.eligibleBelow80After,
        finalEligible: summary.finalEligible,
        finalNotEligible: summary.finalNotEligible,
        laith: summary.laith && {
          universityNumber: summary.laith.universityNumber,
          finalApprovedScore: summary.laith.finalApprovedScore,
          finalApprovedStatus: summary.laith.finalApprovedStatus,
          tasksPoints: summary.laith.tasksPoints,
          laithBlocked: summary.laith.laithBlocked || null,
        },
        eligibleBelow80Students: summary.eligibleBelow80Students,
        persisted: summary.persisted || null,
        appliedAt: summary.appliedAt || null,
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
