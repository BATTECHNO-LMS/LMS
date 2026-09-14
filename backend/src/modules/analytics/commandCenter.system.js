'use strict';

const { prisma } = require('../../config/db');
const { intCount } = require('./analytics.percent');
const { withCache } = require('./analytics.cache');

async function getSystemHealth(scope) {
  if (!scope.modules.systemHealth) {
    return { available: false, reason: 'SUPER_ADMIN_ONLY' };
  }

  return withCache('live', 'system-health', async () => {
    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }

    let letterJobFailures = null;
    try {
      letterJobFailures = await prisma.field_training_completion_letter_jobs.count({
        where: { status: 'failed' },
      });
    } catch {
      letterJobFailures = null;
    }

    return {
      available: true,
      apiStatus: 'ok',
      databaseConnectivity: database,
      completionLetterJobFailures: letterJobFailures,
      omitted: [
        'apiLatency — no request-timing store',
        'apiErrorRate — no 5xx counter',
        '5xxCount — no public error counter',
      ],
    };
  });
}

module.exports = {
  getSystemHealth,
};
