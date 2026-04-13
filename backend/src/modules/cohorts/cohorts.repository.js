const { prisma } = require('../../config/db');

async function findById(id) {
  return prisma.cohorts.findUnique({ where: { id } });
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.cohorts.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });
}

async function create(data) {
  return prisma.cohorts.create({ data });
}

async function update(id, data) {
  return prisma.cohorts.update({ where: { id }, data });
}

async function countEnrollmentsForCapacity(cohortId) {
  return prisma.enrollments.count({
    where: {
      cohort_id: cohortId,
      enrollment_status: { in: ['pending', 'enrolled'] },
    },
  });
}

async function countEnrollments(cohortId) {
  return prisma.enrollments.count({ where: { cohort_id: cohortId } });
}

async function countSessions(cohortId) {
  return prisma.sessions.count({ where: { cohort_id: cohortId } });
}

async function findSessionsDocumentation(cohortId) {
  return prisma.sessions.findMany({
    where: { cohort_id: cohortId },
    select: { id: true, documentation_status: true },
  });
}

async function findMicroCredential(id) {
  return prisma.micro_credentials.findUnique({ where: { id } });
}

async function findUniversity(id) {
  return prisma.universities.findUnique({ where: { id } });
}

async function findUser(id) {
  return prisma.users.findUnique({ where: { id } });
}

async function findMicroCredentialUniversityLink(microCredentialId, universityId) {
  return prisma.micro_credential_universities.findFirst({
    where: { micro_credential_id: microCredentialId, university_id: universityId },
  });
}

module.exports = {
  findById,
  findMany,
  create,
  update,
  countEnrollmentsForCapacity,
  countEnrollments,
  countSessions,
  findSessionsDocumentation,
  findMicroCredential,
  findUniversity,
  findUser,
  findMicroCredentialUniversityLink,
};
