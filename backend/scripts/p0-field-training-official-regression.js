'use strict';

/**
 * Read-only P0 regression: Tafila counts + Laith official result.
 * Does not persist qualification or change training status.
 */

const { prisma } = require('../src/config/db');
const official = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');
const {
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  LAITH_UNIVERSITY_NUMBER,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

const SECOND = '01666ebc-bfc1-4948-87a5-2add3f641c65';

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID, status: 'approved' },
    select: official.applicationSelectForOfficialResult(),
  });
  const results = await official.resolveFieldTrainingApprovedResults(
    apps.map((a) => a.id),
    { applications: apps }
  );
  const eligible = results.filter((r) => r?.eligibility === 'ELIGIBLE');
  const notEligible = results.filter((r) => r?.eligibility === 'NOT_ELIGIBLE');
  const eligibleBelow80 = eligible.filter((r) => r.finalScore == null || Number(r.finalScore) < 80);
  const eligibleNull = eligible.filter((r) => r.finalScore == null);
  let breakdownMismatch = 0;
  for (const r of results) {
    if (r?.finalScore == null) continue;
    const b = r.scoreBreakdown || {};
    if (
      b.attendancePoints == null ||
      b.postAssessmentPoints == null ||
      b.taskPoints == null ||
      b.behaviorPoints == null
    ) {
      continue;
    }
    const sum = Number(b.attendancePoints) + Number(b.postAssessmentPoints) + Number(b.taskPoints) + Number(b.behaviorPoints);
    if (Math.abs(sum - Number(r.finalScore)) > 0.15) breakdownMismatch += 1;
  }

  const profiles = await prisma.users.findMany({
    where: { id: { in: apps.map((a) => a.student_id) } },
    select: { id: true, university_student_number: true, full_name: true },
  });
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const laithApp = apps.find((a) => {
    const uni = String(byId[a.student_id]?.university_student_number || '').trim();
    return uni === LAITH_UNIVERSITY_NUMBER;
  });
  const laith = laithApp ? results.find((r) => r.applicationId === laithApp.id) : null;

  const secondCount = await prisma.field_training_applications.count({
    where: { opportunity_id: SECOND, status: 'approved' },
  });

  const letters = await prisma.field_training_completion_letters.findMany({
    where: { status: 'issued' },
    select: { id: true, application_id: true, letter_no: true, status: true },
  });
  const letterApps = await prisma.field_training_applications.findMany({
    where: { id: { in: letters.map((l) => l.application_id) } },
    select: official.applicationSelectForOfficialResult(),
  });
  const letterAppById = new Map(letterApps.map((a) => [a.id, a]));
  const badLetters = letters.filter((l) => {
    const app = letterAppById.get(l.application_id);
    if (!app) return false;
    const elig = official.officialEligibilityFromApplication(app);
    return elig !== 'ELIGIBLE' || official.isDisqualifyingTrainingStatus(app);
  });

  const out = {
    tafila: {
      students: results.filter(Boolean).length,
      eligible: eligible.length,
      notEligible: notEligible.length,
      eligibleBelow80: eligibleBelow80.length,
      eligibleNull: eligibleNull.length,
      breakdownMismatch,
    },
    secondOpportunityStudents: secondCount,
    laith: laith
      ? {
          applicationId: laith.applicationId,
          eligibility: laith.eligibility,
          finalScore: laith.finalScore,
          submittedTaskCount: laith.submittedTaskCount,
          requiredTaskCount: laith.requiredTaskCount,
          taskPoints: laith.taskPoints,
          attendancePoints: laith.attendancePoints,
          postPoints: laith.postPoints,
          behaviorPoints: laith.behaviorPoints,
          trainingStatus: laith.trainingStatus,
        }
      : null,
    issuedLettersForIneligible: badLetters.length,
    issuedLettersForIneligibleSample: badLetters.slice(0, 10).map((l) => ({
      letterId: l.id,
      letterNo: l.letter_no,
      applicationId: l.application_id,
    })),
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
