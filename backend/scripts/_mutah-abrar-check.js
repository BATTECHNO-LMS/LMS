'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { missingFieldEntries } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
(async () => {
  const app = await prisma.field_training_applications.findFirst({
    where: { id: '4c36f658-e7b8-45b7-affd-4fc80f68fa34' },
  });
  const { byId } = await service.loadBatchContext([app.id]);
  const ctx = byId.get(app.id);
  const att = await prisma.field_training_attendance.count({ where: { application_id: app.id } });
  console.log(JSON.stringify({
    training_status: app.training_status,
    completion_eligibility_status: app.completion_eligibility_status,
    attendance_percentage: app.attendance_percentage,
    completed_training_hours: app.completed_training_hours,
    hours_updated_at: app.hours_updated_at,
    attendanceRows: att,
    scoringInput: ctx?.scoringInput,
    performanceSnapshot: ctx?.performanceSnapshot,
  }, null, 2));
  await prisma.$disconnect();
})();
