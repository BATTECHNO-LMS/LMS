'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma
  .$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'submissions'
      AND indexname = 'uq_submissions_assessment_student'
  `
  .then((rows) => {
    console.log(JSON.stringify({ index_present: rows.length > 0, rows }));
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
