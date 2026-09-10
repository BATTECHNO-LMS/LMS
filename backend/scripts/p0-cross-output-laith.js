'use strict';

const { prisma } = require('../src/config/db');
const { loadApprovedStudentRows } = require('../src/modules/fieldTraining/fieldTraining.cohortReports.service');
const official = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');

const OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const LAITH_APP = 'c8ca4e24-65f0-4a0e-96e0-6042042c7556';

async function main() {
  const rows = await loadApprovedStudentRows(OPP);
  const eligible = rows.filter((r) => r.status === 'eligible');
  const notEligible = rows.filter((r) => r.status === 'ineligible');
  const laith = rows.find((r) => r.applicationId === LAITH_APP);
  const resolved = await official.resolveFieldTrainingApprovedResult(LAITH_APP);
  const mismatches = [];
  if (laith) {
    const pairs = [
      ['eligibility', official.canonicalizeEligibility(laith.status), resolved.eligibility],
      ['finalScore', laith.approvedFinalScore, resolved.finalScore],
      ['attendancePoints', laith.attendancePoints, resolved.attendancePoints],
      ['postPoints', laith.postAssessmentPoints, resolved.postPoints],
      ['taskPoints', laith.taskPoints, resolved.taskPoints],
      ['behaviorPoints', laith.behaviorPoints, resolved.behaviorPoints],
      ['submittedTaskCount', laith.submittedTaskCount, resolved.submittedTaskCount],
      ['requiredTaskCount', laith.requiredTaskCount, resolved.requiredTaskCount],
      ['completedHours', laith.completedHours, resolved.completedTrainingHours],
    ];
    for (const [name, a, b] of pairs) {
      if (String(a) !== String(b)) mismatches.push({ name, report: a, resolver: b });
    }
  }
  console.log(
    JSON.stringify(
      {
        students: rows.length,
        eligible: eligible.length,
        notEligible: notEligible.length,
        eligibleBelow80: eligible.filter((s) => s.approvedFinalScore == null || s.approvedFinalScore < 80).length,
        laith,
        mismatches,
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
    await prisma.$disconnect().catch(() => null);
  });
