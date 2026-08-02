'use strict';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
// eslint-disable-next-line no-console
console.log(
  JSON.stringify({
    hasTrainingTrainerAssignments: typeof p.training_trainer_assignments,
    trainKeys: Object.keys(p).filter((k) => /train/i.test(k)),
  })
);
p.$disconnect();
