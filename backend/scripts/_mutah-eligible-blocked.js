'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { missingFieldEntries } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const user = { userId: 'x', isGlobal: true, roles: ['super_admin'] };
  const readiness = await service.getOpportunityReportReadiness(user, OID);
  const eligibleBlocked = readiness.students.filter(
    (s) => s.eligibilityStatus === 'ELIGIBLE' && (s.missingFields?.length || 0) > 0
  );
  console.log(JSON.stringify({
    dataReady: readiness.counts.dataReady,
    finalReady: readiness.counts.finalReady,
    needsAuthorized: readiness.counts.needsAuthorizedRating,
    eligibleBlockedCount: eligibleBlocked.length,
    eligibleBlocked: eligibleBlocked.map((s) => ({
      name: s.studentName,
      num: s.universityNumber,
      missing: s.missingFieldDetails?.map((f) => f.code || f),
    })),
  }, null, 2));
  await prisma.$disconnect();
})();
