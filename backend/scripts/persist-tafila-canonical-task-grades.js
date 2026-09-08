'use strict';

/**
 * Persist approved Tafila task grades into canonical submission fields
 * (manual_score + review_status=graded) for opportunity
 * 4d9466cb-127b-42f2-ac08-88e7fcc7c7df only.
 *
 *   node scripts/persist-tafila-canonical-task-grades.js
 *   node scripts/persist-tafila-canonical-task-grades.js --apply
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const approvedSvc = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');
const {
  LAITH_UNIVERSITY_NUMBER,
  normalizeUniversityNumber,
  getBaselineByUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

const APPLY = process.argv.includes('--apply');
const OPP = approvedSvc.PRIMARY_TAFILA_OPPORTUNITY_ID;

async function validateAfter() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPP, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      completion_eligibility_status: true,
      eligibility_reason: true,
    },
  });
  const users = await prisma.users.findMany({
    where: { id: { in: apps.map((a) => a.student_id) } },
    select: { id: true, university_student_number: true, full_name: true },
  });
  const byUser = Object.fromEntries(users.map((u) => [u.id, u]));
  const eligibleAppIds = [];
  let laithAppId = null;
  for (const app of apps) {
    const uni = normalizeUniversityNumber(byUser[app.student_id]?.university_student_number);
    if (uni === LAITH_UNIVERSITY_NUMBER) laithAppId = app.id;
    const baseline = uni ? getBaselineByUniversityNumber(uni) : null;
    if (baseline?.excelStatus === 'ELIGIBLE' || uni === LAITH_UNIVERSITY_NUMBER) {
      eligibleAppIds.push(app.id);
    }
  }

  const subs = await prisma.field_training_task_submissions.findMany({
    where: { application_id: { in: eligibleAppIds } },
    include: { field_training_tasks: { select: { title: true, sort_order: true } } },
  });

  let withoutGrade = 0;
  let pending = 0;
  let outOfRange = 0;
  let eligibleBelow80 = 0;
  let eligibleNull = 0;
  let breakdownMismatch = 0;
  let histEligible = 0;
  let eligibleGe80 = 0;

  for (const app of apps) {
    const uni = normalizeUniversityNumber(byUser[app.student_id]?.university_student_number);
    const baseline = uni ? getBaselineByUniversityNumber(uni) : null;
    const approved = app.eligibility_reason?.details?.approvedEvaluationResult;
    if (baseline?.excelStatus === 'ELIGIBLE') {
      histEligible += 1;
      const fs = approved?.approvedFinalScore;
      if (fs == null) eligibleNull += 1;
      else if (Number(fs) < 80) eligibleBelow80 += 1;
      else eligibleGe80 += 1;
      const sb = approved?.scoreBreakdown || {};
      if (fs != null) {
        const sum =
          Number(sb.attendancePoints || 0) +
          Number(sb.postAssessmentPoints || 0) +
          Number(sb.taskPoints || 0) +
          Number(sb.behaviorPoints || 0);
        if (Math.abs(sum - fs) > 0.05) breakdownMismatch += 1;
      }
    }
  }

  for (const s of subs) {
    const uni = normalizeUniversityNumber(
      byUser[apps.find((a) => a.id === s.application_id)?.student_id]?.university_student_number
    );
    const isLaith = uni === LAITH_UNIVERSITY_NUMBER;
    if (s.manual_score == null) withoutGrade += 1;
    if (['pending', 'submitted', 'under_review', 'needs_revision'].includes(s.review_status)) {
      pending += 1;
    }
    if (!isLaith && s.manual_score != null && (s.manual_score < 80 || s.manual_score > 90)) {
      outOfRange += 1;
    }
  }

  let laith = null;
  if (laithAppId) {
    const laithSubs = subs
      .filter((s) => s.application_id === laithAppId)
      .sort((a, b) => (a.field_training_tasks?.sort_order || 0) - (b.field_training_tasks?.sort_order || 0));
    const tasks = await prisma.field_training_tasks.findMany({
      where: { opportunity_id: OPP, NOT: { is_required: false } },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      select: { id: true, title: true },
    });
    const byTask = Object.fromEntries(laithSubs.map((s) => [s.task_id, s]));
    laith = {
      universityNumber: LAITH_UNIVERSITY_NUMBER,
      completed: laithSubs.filter((s) => ['graded', 'approved'].includes(s.review_status)).length,
      required: tasks.length,
      tasks: tasks.map((t) => {
        const s = byTask[t.id];
        return {
          title: t.title,
          status: s ? s.review_status : 'NOT_SUBMITTED',
          score: s?.manual_score ?? null,
        };
      }),
      eligibility:
        apps.find((a) => a.id === laithAppId)?.eligibility_reason?.details?.approvedEvaluationResult
          ?.approvedStatus || null,
    };
  }

  return {
    realSubmittedTasks: subs.length,
    withoutGrade,
    pending,
    outOfRange,
    histEligible,
    eligibleGe80,
    eligibleBelow80,
    eligibleNull,
    breakdownMismatch,
    laith,
    ok:
      withoutGrade === 0 &&
      pending === 0 &&
      outOfRange === 0 &&
      eligibleBelow80 === 0 &&
      eligibleNull === 0 &&
      breakdownMismatch === 0,
  };
}

async function main() {
  const gradePersist = await approvedSvc.persistCanonicalApprovedTaskGrades({
    dryRun: !APPLY,
    actorUserId: null,
  });

  let validation = null;
  if (APPLY) {
    validation = await validateAfter();
  }

  const summary = {
    apply: APPLY,
    opportunityId: OPP,
    gradePersist: {
      realSubmittedTasks: gradePersist.realSubmittedTasks,
      correctedNumericGrades: gradePersist.correctedNumericGrades,
      movedToGraded: gradePersist.movedToGraded,
      unchanged: gradePersist.unchanged,
      fakeSubmissionsCreated: gradePersist.fakeSubmissionsCreated,
      submittedWithoutGradeAfter: gradePersist.submittedWithoutGradeAfter,
      pendingSubmittedAfter: gradePersist.pendingSubmittedAfter,
      changeCount: gradePersist.changes.length,
    },
    validation,
    sampleChanges: gradePersist.changes.slice(0, 10),
  };

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_TASK_GRADES_PERSISTENCE_DRY_RUN.json'
  );
  fs.writeFileSync(outPath, JSON.stringify({ ...summary, changes: gradePersist.changes }, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (APPLY && validation && !validation.ok) {
    throw new Error('Post-apply validation failed');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
