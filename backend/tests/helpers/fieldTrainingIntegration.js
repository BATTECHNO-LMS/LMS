const { prisma } = require('../../src/config/db');
const { signToken } = require('../../src/utils/jwt');
const { seedTestAccounts } = require('../../scripts/lib/testAccounts');

const ADMIN_EMAIL = 'superadmin@batuni.edu';
const INSTRUCTOR_EMAIL = 'instructor@batuni.edu';
const STUDENT_EMAIL = 'student@batuni.edu';

async function canConnectDatabase() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function fieldTrainingMigrationsApplied() {
  try {
    await prisma.$queryRaw`SELECT assigned_instructor_id FROM field_training_opportunities LIMIT 0`;
    await prisma.$queryRaw`SELECT training_status FROM field_training_applications LIMIT 0`;
    await prisma.$queryRaw`SELECT university_specialty_id FROM field_training_opportunity_eligibility LIMIT 0`;
    return true;
  } catch {
    return false;
  }
}

async function ensureIntegrationFixtures() {
  await seedTestAccounts({ log: () => {} });

  const [admin, instructor, student, specialty] = await Promise.all([
    prisma.users.findUnique({ where: { email: ADMIN_EMAIL } }),
    prisma.users.findUnique({ where: { email: INSTRUCTOR_EMAIL } }),
    prisma.users.findUnique({ where: { email: STUDENT_EMAIL } }),
    prisma.specialties.findFirst({ where: { code: 'CYB' } }),
  ]);

  if (!admin || !instructor || !student || !specialty) {
    throw new Error('Integration fixtures incomplete — run seed:test-accounts');
  }

  const universitySpecialty = student.university_specialty_id
    ? await prisma.university_specialties.findUnique({
        where: { id: student.university_specialty_id },
      })
    : await prisma.university_specialties.findFirst({
        where: {
          university_id: student.primary_university_id,
          specialty_id: specialty.id,
          status: 'active',
        },
      });

  if (!universitySpecialty) {
    throw new Error('Integration fixtures missing BATUNI university specialty');
  }

  if (!student.university_specialty_id) {
    await prisma.users.update({
      where: { id: student.id },
      data: { university_specialty_id: universitySpecialty.id },
    });
    student.university_specialty_id = universitySpecialty.id;
  }

  const roleLinks = await prisma.user_roles.findMany({
    where: { user_id: { in: [admin.id, instructor.id, student.id] } },
  });
  const roleRows = roleLinks.length
    ? await prisma.roles.findMany({
        where: { id: { in: [...new Set(roleLinks.map((r) => r.role_id))] } },
        select: { id: true, code: true },
      })
    : [];
  const codeByRoleId = new Map(roleRows.map((r) => [r.id, r.code]));
  const rolesByUser = new Map();
  for (const link of roleLinks) {
    if (!rolesByUser.has(link.user_id)) rolesByUser.set(link.user_id, []);
    const code = codeByRoleId.get(link.role_id);
    if (code) rolesByUser.get(link.user_id).push(code);
  }

  return {
    admin: { ...admin, roleCodes: rolesByUser.get(admin.id) || [] },
    instructor: { ...instructor, roleCodes: rolesByUser.get(instructor.id) || [] },
    student: { ...student, roleCodes: rolesByUser.get(student.id) || [] },
    specialty,
    universitySpecialty,
    universityId: admin.primary_university_id,
  };
}

function rolesForUser(user) {
  return user.roleCodes || [];
}

function bearerForUser(user, { isGlobal = false } = {}) {
  const roles = rolesForUser(user);
  const superAdmin = roles.includes('super_admin');
  return `Bearer ${signToken({
    userId: user.id,
    roles,
    universityId: user.primary_university_id,
    isGlobal: isGlobal || superAdmin,
  })}`;
}

async function cleanupOpportunity(opportunityId) {
  if (!opportunityId) return;
  try {
    await prisma.field_training_opportunities.delete({ where: { id: opportunityId } });
  } catch {
    // already removed
  }
}

function tomorrowDateOnly() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextWeekDateOnly() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  ADMIN_EMAIL,
  INSTRUCTOR_EMAIL,
  STUDENT_EMAIL,
  canConnectDatabase,
  fieldTrainingMigrationsApplied,
  ensureIntegrationFixtures,
  bearerForUser,
  rolesForUser,
  cleanupOpportunity,
  tomorrowDateOnly,
  nextWeekDateOnly,
};
