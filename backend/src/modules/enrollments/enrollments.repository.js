const { prisma } = require('../../config/db');

async function findManyByCohort(cohortId) {
  return prisma.enrollments.findMany({
    where: { cohort_id: cohortId },
    orderBy: { enrolled_at: 'desc' },
  });
}

async function findById(id) {
  return prisma.enrollments.findUnique({ where: { id } });
}

async function findByCohortAndStudent(cohortId, studentId) {
  return prisma.enrollments.findFirst({
    where: { cohort_id: cohortId, student_id: studentId },
  });
}

/** @param {string} studentId */
async function findCohortIdsForStudent(studentId) {
  const rows = await prisma.enrollments.findMany({
    where: {
      student_id: studentId,
      enrollment_status: { in: ['pending', 'enrolled', 'completed'] },
    },
    select: { cohort_id: true },
  });
  return [...new Set(rows.map((r) => r.cohort_id))];
}

async function create(data) {
  return prisma.enrollments.create({ data });
}

async function update(id, data) {
  return prisma.enrollments.update({ where: { id }, data });
}

async function userHasRoleCode(userId, roleCode) {
  const role = await prisma.roles.findFirst({
    where: { code: roleCode },
  });
  if (!role) return false;
  const link = await prisma.user_roles.findFirst({
    where: { user_id: userId, role_id: role.id },
  });
  return Boolean(link);
}

async function findUserBrief(id) {
  return prisma.users.findUnique({
    where: { id },
    select: { id: true, full_name: true, email: true, status: true },
  });
}

module.exports = {
  findManyByCohort,
  findById,
  findByCohortAndStudent,
  findCohortIdsForStudent,
  create,
  update,
  userHasRoleCode,
  findUserBrief,
};
