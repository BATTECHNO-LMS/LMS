'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../backend/.env') });
const { PrismaClient } = require('../../../backend/node_modules/@prisma/client');

const PRIMARY_TAFILA_OPPORTUNITY_ID = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const SECOND_TAFILA_OPPORTUNITY_ID = '01666ebc-bfc1-4948-87a5-2add3f641c65';
const LAITH_UNI = '320230601066';

function createPrisma() {
  return new PrismaClient();
}

function assertReadOnlyMode() {
  const host = String(process.env.DATABASE_URL || '');
  const isNeonProd = host.includes('ep-divine-dust') || host.includes('neon.tech');
  return {
    isNeonProd,
    allowMutations: process.env.QA_ALLOW_MUTATIONS === 'true' && !isNeonProd,
    hostHint: host.includes('@') ? host.split('@')[1]?.split('/')[0] : 'unknown',
  };
}

module.exports = {
  createPrisma,
  assertReadOnlyMode,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  SECOND_TAFILA_OPPORTUNITY_ID,
  LAITH_UNI,
};
