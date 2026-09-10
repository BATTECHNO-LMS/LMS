'use strict';

const { prisma } = require('../src/config/db');
const official = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');
const excel = require('../src/modules/fieldTraining/fieldTrainingStudentsExcel');
const { PRIMARY_TAFILA_OPPORTUNITY_ID } = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID, status: 'approved' },
    select: official.applicationSelectForOfficialResult(),
  });
  const results = await official.resolveFieldTrainingApprovedResults(
    apps.map((a) => a.id),
    { applications: apps }
  );
  let mismatches = 0;
  const families = {};
  for (const row of results) {
    if (!row) {
      mismatches += 1;
      continue;
    }
    families[row.policy] = (families[row.policy] || 0) + 1;
    const pub = official.toPublicQualificationFromOfficial(row);
    const excelRow = excel.mapStudentExcelRow(
      {
        qualification: pub,
        officialResult: row,
        eligibility_status: row.eligibilityDb,
        completion_eligibility_status: row.eligibilityDb,
        training_status: row.trainingStatus,
      },
      0
    );
    const excelScore =
      excelRow.finalScore === '' || excelRow.finalScore == null ? null : Number(excelRow.finalScore);
    if (pub.finalScore !== row.finalScore) mismatches += 1;
    if (pub.eligibilityStatus !== row.eligibility) mismatches += 1;
    if (excelScore !== row.finalScore && !(excelScore == null && row.finalScore == null)) mismatches += 1;
    if (official.isOfficiallyEligible(row) !== (row.eligibility === 'ELIGIBLE')) mismatches += 1;
  }
  console.log(
    JSON.stringify(
      {
        students: results.filter(Boolean).length,
        mismatches,
        families,
        letterEligible: results.filter((r) => official.isOfficiallyEligible(r)).length,
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
