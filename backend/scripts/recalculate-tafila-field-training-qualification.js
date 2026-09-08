'use strict';

/**
 * Dry-run / apply Tafila Field Training 20/20/40/20 qualification recalculation.
 *
 * Usage:
 *   node scripts/recalculate-tafila-field-training-qualification.js
 *   node scripts/recalculate-tafila-field-training-qualification.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { prisma } = require('../src/config/db');
const {
  TAFILA_POLICY_CODE,
  TAFILA_SCORING_RULES,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const qualificationService = require('../src/modules/fieldTraining/fieldTraining.qualification.service');
const scoring = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');

const PRIMARY_OPPORTUNITY_ID = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const DUPLICATE_OPPORTUNITY_ID = '01666ebc-bfc1-4948-87a5-2add3f641c65';
const TAFILA_UNIVERSITY_ID = '35c16bfc-a5a9-4de8-8d44-d9230235b334';
const APPLY = process.argv.includes('--apply');

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isTestStudent(student) {
  const hay = `${student?.full_name || ''} ${student?.email || ''}`.toLowerCase();
  return /test|demo|تجريب/.test(hay);
}

async function main() {
  const duplicate = await prisma.field_training_opportunities.findUnique({
    where: { id: DUPLICATE_OPPORTUNITY_ID },
    select: { id: true, title: true, status: true, slug: true },
  });
  const duplicateReport = {
    flag: 'DUPLICATE_TAFILA_OPPORTUNITY_REQUIRES_REVIEW',
    opportunityId: DUPLICATE_OPPORTUNITY_ID,
    title: duplicate?.title || null,
    status: duplicate?.status || null,
    includedInRecalculation: false,
  };

  const eligibility = await prisma.field_training_opportunity_eligibility.findFirst({
    where: { opportunity_id: PRIMARY_OPPORTUNITY_ID, is_active: true },
    select: { university_id: true },
  });
  const universityId = eligibility?.university_id || TAFILA_UNIVERSITY_ID;

  await qualificationService.ensureTafilaPolicy(universityId, null);

  const applications = await prisma.field_training_applications.findMany({
    where: { opportunity_id: PRIMARY_OPPORTUNITY_ID, status: 'approved' },
    orderBy: { created_at: 'asc' },
  });
  const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
  const profiles = await repo.findStudentProfilesByIds([...new Set(applications.map((app) => app.student_id))]);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const real = applications.filter((app) => !isTestStudent(profileById.get(app.student_id)));
  const currentEvals = await prisma.field_training_final_evaluations.findMany({
    where: {
      application_id: { in: real.map((app) => app.id) },
      is_current: true,
    },
    select: { application_id: true, final_score: true },
  });
  const oldScoreByApp = new Map(currentEvals.map((row) => [row.application_id, num(row.final_score)]));

  const calculatedRows = await qualificationService.calculateForApplications(real.map((app) => app.id));
  const byId = new Map(calculatedRows.map((row) => [row.applicationId, row]));

  let approvedWithoutNumeric = 0;
  const students = real.map((app) => {
    const row = byId.get(app.id);
    const calculated = row?.calculated;
    const publicQ = row?.public;
    const oldEligibility = app.completion_eligibility_status;
    const newEligibility = calculated?.workflowOutcome;
    const oldScore = oldScoreByApp.get(app.id) ?? num(app.eligibility_reason?.details?.finalScore);
    const taskDetails = calculated?.scoreComponents?.tasks?.details || [];
    approvedWithoutNumeric += taskDetails.filter((item) => item.source === 'APPROVED_WITHOUT_NUMERIC_GRADE').length;
    return {
      applicationId: app.id,
      studentName: profileById.get(app.student_id)?.full_name || '',
      universityNumber: profileById.get(app.student_id)?.university_student_number || '',
      oldEligibility,
      newEligibility,
      oldFinalScore: oldScore,
      newFinalScore: calculated?.finalScore ?? null,
      attendancePoints: calculated?.attendanceComponentScore ?? null,
      postPoints: calculated?.postAssessmentComponentScore ?? null,
      tasksPoints: calculated?.tasksComponentScore ?? null,
      behaviorPoints: calculated?.professionalComponentScore ?? null,
      gates: calculated?.mandatoryRequirements || {},
      reasons: calculated?.eligibilityReasonLabels || [],
      scoreStatus: calculated?.scoreStatus,
      qualification: publicQ,
    };
  });

  const oldEligible = students.filter((row) => row.oldEligibility === 'eligible').length;
  const oldNotEligible = students.filter((row) => row.oldEligibility === 'ineligible').length;
  const newEligible = students.filter((row) => row.newEligibility === 'eligible').length;
  const newNotEligible = students.filter((row) => row.newEligibility === 'ineligible').length;
  const newNeedsReview = students.filter((row) => row.newEligibility === 'needs_review').length;
  const eligibilityChanged = students.filter((row) => row.oldEligibility !== row.newEligibility);
  const scoreChanged = students.filter((row) => String(row.oldFinalScore) !== String(row.newFinalScore));
  const nullNewScore = students.filter((row) => row.newFinalScore == null);
  const eligibleNullScore = students.filter((row) => row.newEligibility === 'eligible' && row.newFinalScore == null);
  const below80Eligible = students.filter(
    (row) => row.newEligibility === 'eligible' && row.newFinalScore != null && row.newFinalScore < 80
  );
  const ge80Ineligible = students.filter(
    (row) =>
      row.newEligibility === 'ineligible' &&
      row.newFinalScore != null &&
      row.newFinalScore >= 80
  );

  const validations = [];
  const weightCheck = scoring.validatePolicyWeights({
    attendanceWeight: 20,
    tasksWeight: 40,
    postAssessmentWeight: 20,
    professionalEvaluationWeight: 20,
  });
  validations.push({ name: 'weights_total_100', ok: weightCheck.ok && weightCheck.total === 100 });
  validations.push({
    name: 'no_score_over_100',
    ok: students.every((row) => row.newFinalScore == null || row.newFinalScore <= 100),
  });
  validations.push({
    name: 'no_score_below_0',
    ok: students.every((row) => row.newFinalScore == null || row.newFinalScore >= 0),
  });
  validations.push({ name: 'eligible_non_null_score', ok: eligibleNullScore.length === 0 });
  validations.push({
    name: 'eligible_score_gte_80',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.newFinalScore >= 80),
  });
  validations.push({
    name: 'eligible_attendance',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.attendanceRequirementMet),
  });
  validations.push({
    name: 'eligible_hours',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.hoursRequirementMet),
  });
  validations.push({
    name: 'eligible_pre',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.preAssessmentCompleted),
  });
  validations.push({
    name: 'eligible_post',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.postAssessmentCompleted),
  });
  validations.push({
    name: 'eligible_tasks',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.requiredTasksCompleted),
  });
  validations.push({
    name: 'eligible_behavior',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.gates.behaviorEvaluationComplete),
  });
  validations.push({ name: 'no_below_80_eligible', ok: below80Eligible.length === 0 });

  const nullCategories = {
    missingPost: nullNewScore.filter((row) => row.gates.postAssessmentCompleted === false).length,
    missingBehavior: nullNewScore.filter((row) => row.gates.behaviorEvaluationComplete === false).length,
    missingAttendance: nullNewScore.filter((row) => row.attendancePoints == null).length,
    missingTasks: nullNewScore.filter((row) => row.tasksPoints == null).length,
  };

  const summary = {
    policyCode: TAFILA_POLICY_CODE,
    scoringRules: TAFILA_SCORING_RULES,
    opportunityId: PRIMARY_OPPORTUNITY_ID,
    duplicateOpportunity: duplicateReport,
    apply: APPLY,
    students: students.length,
    oldEligible,
    oldNotEligible,
    newEligible,
    newNotEligible,
    newNeedsReview,
    eligibilityChanged: eligibilityChanged.length,
    scoreChanged: scoreChanged.length,
    nullNewScore: nullNewScore.length,
    eligibleNullScore: eligibleNullScore.length,
    ge80Ineligible: ge80Ineligible.length,
    below80Eligible: below80Eligible.length,
    approvedWithoutNumericGrade: approvedWithoutNumeric,
    validations,
    validationPassed: validations.every((row) => row.ok),
    nullCategories,
    changedStudents: eligibilityChanged.map((row) => ({
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      oldEligibility: row.oldEligibility,
      newEligibility: row.newEligibility,
      oldFinalScore: row.oldFinalScore,
      newFinalScore: row.newFinalScore,
      reasons: row.reasons,
    })),
  };

  const outDir = path.join(__dirname, '..', '..');
  const dryPath = path.join(outDir, 'BATTECHNO_LMS_TAFILA_SCORING_DRY_RUN.json');
  fs.writeFileSync(dryPath, JSON.stringify({ summary, students }, null, 2), 'utf8');

  if (APPLY) {
    if (!summary.validationPassed) {
      throw new Error('Refusing to persist: dry-run validation failed');
    }
    const ids = real.map((app) => app.id);
    let persisted = 0;
    for (const id of ids) {
      await qualificationService.persistQualification(id, { snapshotEvaluation: true });
      persisted += 1;
    }
    summary.persisted = persisted;
    summary.appliedAt = new Date().toISOString();
    fs.writeFileSync(dryPath, JSON.stringify({ summary, students }, null, 2), 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
