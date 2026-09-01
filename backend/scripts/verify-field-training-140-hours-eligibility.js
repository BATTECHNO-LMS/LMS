'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const hours = require('../src/modules/fieldTraining/fieldTraining.hours');
const excel = require('../src/modules/fieldTraining/fieldTrainingStudentsExcel');
const labels = require('../src/modules/fieldTraining/fieldTrainingReport.labels');

const IDS = [
  'acbf52ca-d9d1-41cc-9b9b-312e9493094f',
  '28dff5b8-2ba4-4ce2-b050-fa4fc14d6bbb',
  'ef457c1e-7ad4-4d3f-b122-78bc8d721fb1',
  '00792f60-0bbf-490d-ad38-e3fce1042d04',
];

async function main() {
  const rows = await prisma.field_training_applications.findMany({
    where: { id: { in: IDS } },
    select: {
      id: true,
      completed_training_hours: true,
      completion_eligibility_status: true,
      training_status: true,
      hours_updated_at: true,
    },
  });
  const audits = await prisma.audit_logs.count({
    where: { action_type: 'FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1' },
  });
  const eligible140 = await prisma.field_training_applications.count({
    where: {
      completion_eligibility_status: 'eligible',
      completed_training_hours: { gte: 140 },
      status: 'approved',
    },
  });
  const sample = rows.map((row) => {
    const mapped = excel.mapStudentExcelRow(
      {
        completion_eligibility_status: row.completion_eligibility_status,
        completed_training_hours: row.completed_training_hours,
      },
      0
    );
    return {
      id: row.id,
      hours: row.completed_training_hours,
      hoursLabel: hours.formatCompletedHoursLabelAr(row.completed_training_hours),
      eligibility: row.completion_eligibility_status,
      eligibilityLabel: labels.ELIGIBILITY_AR[row.completion_eligibility_status],
      training_status: row.training_status,
      excelHours: mapped.completedHoursLabel,
      excelEligibility: mapped.eligibilityStatus,
    };
  });
  console.log(JSON.stringify({ audits, eligible140, sample }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
