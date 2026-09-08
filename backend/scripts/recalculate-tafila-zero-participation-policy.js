'use strict';

/**
 * Dry-run / apply Tafila zero-participation + task eligibility policy.
 *
 * Usage:
 *   node scripts/recalculate-tafila-zero-participation-policy.js
 *   node scripts/recalculate-tafila-zero-participation-policy.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { prisma } = require('../src/config/db');
const {
  TAFILA_POLICY_CODE,
  TAFILA_SCORING_RULES,
  GATE_REASONS,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const qualificationService = require('../src/modules/fieldTraining/fieldTraining.qualification.service');

const PRIMARY_OPPORTUNITY_ID = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const TAFILA_UNIVERSITY_ID = '35c16bfc-a5a9-4de8-8d44-d9230235b334';
const LAITH_UNI = '320230601066';
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
  const profiles = await repo.findStudentProfilesByIds([
    ...new Set(applications.map((app) => app.student_id)),
  ]);
  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const real = applications.filter((app) => !isTestStudent(profileById.get(app.student_id)));

  const calculatedRows = await qualificationService.calculateForApplications(real.map((app) => app.id));
  const byId = new Map(calculatedRows.map((row) => [row.applicationId, row]));

  const students = real.map((app) => {
    const profile = profileById.get(app.student_id) || {};
    const row = byId.get(app.id);
    const calculated = row?.calculated;
    const components = calculated?.scoreComponents || {};
    return {
      applicationId: app.id,
      studentName: profile.full_name || '',
      universityNumber: profile.university_student_number || '',
      preCompleted: calculated?.preAssessmentScore != null,
      submittedTasks: calculated?.submittedRequiredTaskCount ?? 0,
      acceptedTasks: components.tasks?.acceptedCount ?? null,
      requiredTasks: components.tasks?.requiredCount ?? null,
      oldAttendance: num(app.attendance_percentage),
      effectiveAttendance: calculated?.attendancePercent ?? null,
      recordedAttendance: calculated?.recordedAttendancePercent ?? null,
      oldFinalScore: num(app.eligibility_reason?.details?.finalScore),
      newFinalScore: calculated?.finalScore ?? null,
      oldEligibility: app.completion_eligibility_status,
      newEligibility: calculated?.workflowOutcome,
      zeroParticipationApplied: Boolean(calculated?.zeroParticipationApplied),
      eligibilityOverride: calculated?.eligibilityOverride || null,
      reasons: calculated?.eligibilityReasonLabels || [],
      reasonCodes: calculated?.eligibilityReasons || [],
      attendancePoints: calculated?.attendanceComponentScore ?? null,
      postPoints: calculated?.postAssessmentComponentScore ?? null,
      tasksPoints: calculated?.tasksComponentScore ?? null,
      behaviorPoints: calculated?.professionalComponentScore ?? null,
    };
  });

  const zeroParticipationStudents = students.filter((row) => row.zeroParticipationApplied);
  const laith = students.find((row) => String(row.universityNumber) === LAITH_UNI) || null;

  const validations = [];
  validations.push({
    name: 'zero_participation_pre_incomplete',
    ok: zeroParticipationStudents.every((row) => row.preCompleted === false),
  });
  validations.push({
    name: 'zero_participation_zero_submitted_tasks',
    ok: zeroParticipationStudents.every((row) => row.submittedTasks === 0),
  });
  validations.push({
    name: 'zero_participation_effective_attendance_zero',
    ok: zeroParticipationStudents.every((row) => Number(row.effectiveAttendance) === 0),
  });
  validations.push({
    name: 'zero_participation_task_points_zero',
    ok: zeroParticipationStudents.every((row) => Number(row.tasksPoints) === 0),
  });
  validations.push({
    name: 'zero_participation_final_score_zero',
    ok: zeroParticipationStudents.every((row) => Number(row.newFinalScore) === 0),
  });
  validations.push({
    name: 'zero_participation_not_eligible',
    ok: zeroParticipationStudents.every((row) => row.newEligibility === 'ineligible'),
  });
  validations.push({
    name: 'no_zero_participation_with_pre',
    ok: students
      .filter((row) => row.preCompleted)
      .every((row) => row.zeroParticipationApplied === false),
  });
  validations.push({
    name: 'no_zero_participation_with_submitted_tasks',
    ok: students
      .filter((row) => row.submittedTasks >= 1)
      .every((row) => row.zeroParticipationApplied === false),
  });
  validations.push({
    name: 'laith_found',
    ok: Boolean(laith),
  });
  validations.push({
    name: 'laith_not_eligible',
    ok: laith ? laith.newEligibility === 'ineligible' : false,
  });
  validations.push({
    name: 'laith_marks_preserved',
    ok: laith
      ? laith.zeroParticipationApplied === false &&
        (laith.newFinalScore == null || Number(laith.newFinalScore) > 0) &&
        Number(laith.attendancePoints) > 0 &&
        Number(laith.tasksPoints) > 0
      : false,
  });
  validations.push({
    name: 'laith_no_zero_participation',
    ok: laith ? laith.zeroParticipationApplied === false : false,
  });
  validations.push({
    name: 'laith_has_override_reason',
    ok: laith
      ? (laith.reasonCodes || []).includes(GATE_REASONS.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION)
      : false,
  });
  validations.push({
    name: 'no_below_80_eligible',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => row.newFinalScore != null && row.newFinalScore >= 80),
  });
  validations.push({
    name: 'eligible_tasks_complete_or_partial_waiver',
    ok: students
      .filter((row) => row.newEligibility === 'eligible')
      .every((row) => {
        const acceptedOk =
          row.acceptedTasks != null &&
          row.requiredTasks != null &&
          row.acceptedTasks >= row.requiredTasks;
        const partialOk =
          row.newFinalScore != null &&
          row.newFinalScore >= 80 &&
          Number(row.submittedTasks) >= 1;
        return acceptedOk || partialOk;
      }),
  });

  const eligibilityChanged = students.filter((row) => row.oldEligibility !== row.newEligibility);
  const scoreChanged = students.filter(
    (row) => String(row.oldFinalScore) !== String(row.newFinalScore)
  );

  const summary = {
    policyCode: TAFILA_POLICY_CODE,
    scoringRules: TAFILA_SCORING_RULES,
    opportunityId: PRIMARY_OPPORTUNITY_ID,
    apply: APPLY,
    students: students.length,
    oldEligible: students.filter((row) => row.oldEligibility === 'eligible').length,
    newEligible: students.filter((row) => row.newEligibility === 'eligible').length,
    newNotEligible: students.filter((row) => row.newEligibility === 'ineligible').length,
    eligibilityChanged: eligibilityChanged.length,
    scoreChanged: scoreChanged.length,
    zeroParticipationCount: zeroParticipationStudents.length,
    zeroParticipationStudents: zeroParticipationStudents.map((row) => ({
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      oldAttendance: row.oldAttendance,
      effectiveAttendance: row.effectiveAttendance,
      oldFinalScore: row.oldFinalScore,
      newFinalScore: row.newFinalScore,
      oldEligibility: row.oldEligibility,
      newEligibility: row.newEligibility,
      reasons: row.reasons,
    })),
    laith: laith
      ? {
          universityNumber: laith.universityNumber,
          studentName: laith.studentName,
          newFinalScore: laith.newFinalScore,
          newEligibility: laith.newEligibility,
          zeroParticipationApplied: laith.zeroParticipationApplied,
          reasons: laith.reasons,
        }
      : null,
    validations,
    validationPassed: validations.every((row) => row.ok),
    changedStudents: eligibilityChanged.map((row) => ({
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      oldEligibility: row.oldEligibility,
      newEligibility: row.newEligibility,
      oldFinalScore: row.oldFinalScore,
      newFinalScore: row.newFinalScore,
      zeroParticipationApplied: row.zeroParticipationApplied,
      reasons: row.reasons,
    })),
  };

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_ZERO_PARTICIPATION_DRY_RUN.json'
  );
  fs.writeFileSync(outPath, JSON.stringify({ summary, students }, null, 2), 'utf8');

  if (APPLY) {
    if (!summary.validationPassed) {
      throw new Error('Refusing to persist: dry-run validation failed');
    }
    let persisted = 0;
    const snapshotIds = [];
    for (const app of real) {
      const row = byId.get(app.id);
      if (!row?.calculated || !row?.ctx) continue;
      await qualificationService.persistApplicationEligibility(app.id, row.calculated, row.ctx);
      if (
        row.calculated.zeroParticipationApplied ||
        row.calculated.eligibilityOverride ||
        String(app.eligibility_reason?.details?.finalScore) !== String(row.calculated.finalScore)
      ) {
        snapshotIds.push(app.id);
      }
      persisted += 1;
      if (persisted % 25 === 0) {
        console.log(`persisted ${persisted}/${real.length}`);
      }
    }
    let snapshotted = 0;
    for (const id of snapshotIds) {
      const row = byId.get(id);
      try {
        await qualificationService.snapshotCurrentEvaluation(id, row.calculated, row.ctx);
        snapshotted += 1;
      } catch {
        // ignore missing evaluation rows
      }
    }
    summary.persisted = persisted;
    summary.snapshotted = snapshotted;
    summary.appliedAt = new Date().toISOString();
    fs.writeFileSync(outPath, JSON.stringify({ summary, students }, null, 2), 'utf8');
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
