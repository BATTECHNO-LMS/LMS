const { prisma, withDbRetry } = require('../../config/db');

async function findById(id) {
  return withDbRetry(() => prisma.cohorts.findUnique({ where: { id } }));
}

async function findManyByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  return withDbRetry(() => prisma.cohorts.findMany({ where: { id: { in: unique } } }));
}

async function findMicroCredentialsByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  return withDbRetry(() =>
    prisma.micro_credentials.findMany({
      where: { id: { in: unique } },
      select: { id: true, title: true, code: true, status: true, description: true },
    })
  );
}

async function findUniversitiesByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  return withDbRetry(() =>
    prisma.universities.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, status: true },
    })
  );
}

async function count(where) {
  return withDbRetry(() => prisma.cohorts.count({ where }));
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return withDbRetry(() =>
    prisma.cohorts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take,
    })
  );
}

async function create(data) {
  return withDbRetry(() => prisma.cohorts.create({ data }));
}

async function update(id, data) {
  return withDbRetry(() => prisma.cohorts.update({ where: { id }, data }));
}

async function countEnrollmentsForCapacity(cohortId) {
  return withDbRetry(() =>
    prisma.enrollments.count({
      where: {
        cohort_id: cohortId,
        enrollment_status: { in: ['pending', 'enrolled'] },
      },
    })
  );
}

async function countEnrollmentsForCapacityByCohortIds(cohortIds) {
  const unique = [...new Set((cohortIds || []).filter(Boolean))];
  if (!unique.length) return [];
  return withDbRetry(() =>
    prisma.enrollments.groupBy({
      by: ['cohort_id'],
      where: {
        cohort_id: { in: unique },
        enrollment_status: { in: ['pending', 'enrolled'] },
      },
      _count: { _all: true },
    })
  );
}

async function countEnrollments(cohortId) {
  return withDbRetry(() =>
    prisma.enrollments.count({ where: { cohort_id: cohortId } })
  );
}

async function countSessions(cohortId) {
  return withDbRetry(() =>
    prisma.sessions.count({ where: { cohort_id: cohortId } })
  );
}

async function findSessionsDocumentation(cohortId) {
  return withDbRetry(() =>
    prisma.sessions.findMany({
      where: { cohort_id: cohortId },
      select: { id: true, documentation_status: true },
    })
  );
}

async function findMicroCredential(id) {
  return withDbRetry(() =>
    prisma.micro_credentials.findUnique({ where: { id } })
  );
}

async function findUniversity(id) {
  return withDbRetry(() => prisma.universities.findUnique({ where: { id } }));
}

async function findUser(id) {
  return withDbRetry(() => prisma.users.findUnique({ where: { id } }));
}

async function findMicroCredentialUniversityLink(microCredentialId, universityId) {
  return withDbRetry(() =>
    prisma.micro_credential_universities.findFirst({
      where: { micro_credential_id: microCredentialId, university_id: universityId },
    })
  );
}

module.exports = {
  findById,
  findManyByIds,
  findMicroCredentialsByIds,
  findUniversitiesByIds,
  count,
  findMany,
  create,
  update,
  countEnrollmentsForCapacity,
  countEnrollmentsForCapacityByCohortIds,
  countEnrollments,
  countSessions,
  findSessionsDocumentation,
  findMicroCredential,
  findUniversity,
  findUser,
  findMicroCredentialUniversityLink,
};
