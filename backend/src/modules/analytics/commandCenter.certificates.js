'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { intCount } = require('./analytics.percent');
const { periodChange } = require('./analytics.percent');

const { startOfAmmanDay } = require('./analytics.period');

async function getCertificateAnalytics(scope, period) {
  const uniFilter = scope.universityId
    ? Prisma.sql`AND co.university_id = ${scope.universityId}::uuid`
    : Prisma.empty;
  const orgFilter = scope.organizationId
    ? Prisma.sql`AND tc.organization_id = ${scope.organizationId}::uuid`
    : Prisma.empty;

  const todayStart = startOfAmmanDay(period.periodEnd);

  const [mcPeriod, mcPrev, mcToday, trainingPeriod, lettersPeriod] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM certificates cert
      JOIN cohorts co ON co.id = cert.cohort_id
      WHERE cert.status = 'issued'::certificate_status
        AND cert.issued_at >= ${period.periodStart}
        AND cert.issued_at < ${period.periodEnd}
        ${uniFilter}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM certificates cert
      JOIN cohorts co ON co.id = cert.cohort_id
      WHERE cert.status = 'issued'::certificate_status
        AND cert.issued_at >= ${period.previousStart}
        AND cert.issued_at < ${period.previousEnd}
        ${uniFilter}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM certificates cert
      JOIN cohorts co ON co.id = cert.cohort_id
      WHERE cert.status = 'issued'::certificate_status
        AND cert.issued_at >= ${todayStart}
        AND cert.issued_at < ${period.periodEnd}
        ${uniFilter}
    `.catch(() => [{ c: 0 }]),
    scope.modules.trainingPrograms
      ? prisma.$queryRaw`
          SELECT COUNT(*)::int AS c
          FROM training_certificates tc
          WHERE tc.status = 'ISSUED'::training_certificate_status
            AND tc.issued_at >= ${period.periodStart}
            AND tc.issued_at < ${period.periodEnd}
            ${orgFilter}
        `
      : Promise.resolve([{ c: 0 }]),
    scope.modules.fieldTraining
      ? prisma.$queryRaw`
          SELECT COUNT(*)::int AS c
          FROM field_training_completion_letters l
          JOIN field_training_applications app ON app.id = l.application_id
          WHERE l.status = 'issued'::field_training_completion_letter_status
            AND l.issued_at >= ${period.periodStart}
            AND l.issued_at < ${period.periodEnd}
            ${scope.universityId ? Prisma.sql`AND EXISTS (
              SELECT 1 FROM field_training_opportunities o
              WHERE o.id = app.opportunity_id AND o.university_id = ${scope.universityId}::uuid
            )` : Prisma.empty}
            ${scope.opportunityId ? Prisma.sql`AND app.opportunity_id = ${scope.opportunityId}::uuid` : Prisma.empty}
        `
      : Promise.resolve([{ c: 0 }]),
  ]);

  const mcIssued = intCount(mcPeriod[0]?.c);
  const trainingIssued = intCount(trainingPeriod[0]?.c);
  const totalIssued = mcIssued + trainingIssued;

  return {
    certificatesIssued: totalIssued,
    issuedToday: intCount(mcToday[0]?.c) + trainingIssued,
    microCredentialCertificates: mcIssued,
    trainingCertificates: trainingIssued,
    completionLetters: intCount(lettersPeriod[0]?.c),
    comparison: periodChange(mcIssued, intCount(mcPrev[0]?.c), { hasPreviousPeriod: period.hasComparison }),
    note: 'Completion letters are not counted as certificates.',
  };
}

module.exports = {
  getCertificateAnalytics,
};
