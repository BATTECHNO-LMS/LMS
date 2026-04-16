const { prisma } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const TEMP_PASSWORD = '12345678';
const UNIVERSITY_NAME = 'BATTECHNO University';
const UNIVERSITY_DOMAIN = 'batuni.edu';

const UNIVERSITY_SEED = {
  name: UNIVERSITY_NAME,
  type: 'University',
  contact_person: 'System Admin',
  contact_email: 'admin@batuni.edu',
  contact_phone: '+962700000000',
  status: 'active',
  partnership_state: 'active',
  notes: 'Development seed university',
};

const REQUIRED_ROLES = [
  { code: 'super_admin', name: 'Super Admin', scope: 'global' },
  { code: 'program_admin', name: 'Program Admin', scope: 'university' },
  { code: 'academic_admin', name: 'Academic Admin', scope: 'university' },
  { code: 'qa_officer', name: 'QA Officer', scope: 'university' },
  { code: 'instructor', name: 'Instructor', scope: 'university' },
  { code: 'student', name: 'Student', scope: 'university' },
  { code: 'university_reviewer', name: 'University Reviewer', scope: 'university' },
];

const SEEDED_USERS = [
  { full_name: 'Super Admin', email: 'superadmin@batuni.edu', role: 'super_admin' },
  { full_name: 'Program Admin', email: 'programadmin@batuni.edu', role: 'program_admin' },
  { full_name: 'Academic Admin', email: 'academicadmin@batuni.edu', role: 'academic_admin' },
  { full_name: 'QA Officer', email: 'qaofficer@batuni.edu', role: 'qa_officer' },
  { full_name: 'Main Instructor', email: 'instructor@batuni.edu', role: 'instructor' },
  { full_name: 'Student One', email: 'student1@batuni.edu', role: 'student' },
  { full_name: 'Student Two', email: 'student2@batuni.edu', role: 'student' },
  { full_name: 'University Reviewer', email: 'reviewer@batuni.edu', role: 'university_reviewer' },
];

function relationshipTypeForRole(roleCode) {
  if (roleCode === 'student') return 'student';
  if (roleCode === 'instructor') return 'instructor';
  if (roleCode === 'university_reviewer') return 'reviewer';
  return 'staff';
}

async function ensureRole(roleSeed) {
  return prisma.roles.upsert({
    where: { code: roleSeed.code },
    update: {
      name: roleSeed.name,
      scope: roleSeed.scope,
      description: roleSeed.name,
    },
    create: {
      name: roleSeed.name,
      code: roleSeed.code,
      scope: roleSeed.scope,
      description: roleSeed.name,
    },
  });
}

async function ensureUniversity() {
  return prisma.universities.upsert({
    where: { name: UNIVERSITY_NAME },
    update: UNIVERSITY_SEED,
    create: UNIVERSITY_SEED,
  });
}

async function ensureUniversityDomain(universityId) {
  const existing = await prisma.university_email_domains.findFirst({
    where: {
      university_id: universityId,
      domain: UNIVERSITY_DOMAIN,
    },
  });

  if (existing) {
    return prisma.university_email_domains.update({
      where: { id: existing.id },
      data: { is_active: true },
    });
  }

  return prisma.university_email_domains.create({
    data: {
      university_id: universityId,
      domain: UNIVERSITY_DOMAIN,
      is_active: true,
    },
  });
}

async function ensureUserWithRole(userSeed, roleByCode, passwordHash, universityId) {
  const role = roleByCode.get(userSeed.role);
  if (!role) {
    throw new Error(`Missing role in seed map: ${userSeed.role}`);
  }

  const user = await prisma.users.upsert({
    where: { email: userSeed.email.toLowerCase() },
    update: {
      full_name: userSeed.full_name,
      password_hash: passwordHash,
      status: 'active',
      primary_university_id: universityId,
    },
    create: {
      full_name: userSeed.full_name,
      email: userSeed.email.toLowerCase(),
      password_hash: passwordHash,
      status: 'active',
      primary_university_id: universityId,
    },
  });

  const userRole = await prisma.user_roles.findFirst({
    where: { user_id: user.id, role_id: role.id },
    select: { id: true },
  });
  if (!userRole) {
    await prisma.user_roles.create({
      data: {
        user_id: user.id,
        role_id: role.id,
      },
    });
  }

  const universityUser = await prisma.university_users.findFirst({
    where: { university_id: universityId, user_id: user.id },
    select: { id: true },
  });
  if (!universityUser) {
    await prisma.university_users.create({
      data: {
        university_id: universityId,
        user_id: user.id,
        relationship_type: relationshipTypeForRole(userSeed.role),
      },
    });
  }

  return user;
}

async function main() {
  const passwordHash = await hashPassword(TEMP_PASSWORD);

  const roles = await Promise.all(REQUIRED_ROLES.map((r) => ensureRole(r)));
  const roleByCode = new Map(roles.map((r) => [r.code, r]));

  const university = await ensureUniversity();
  await ensureUniversityDomain(university.id);

  for (const userSeed of SEEDED_USERS) {
    await ensureUserWithRole(userSeed, roleByCode, passwordHash, university.id);
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed successfully.');
  // eslint-disable-next-line no-console
  console.log('University:', university.name, university.id);
  // eslint-disable-next-line no-console
  console.log('Allowed domain:', UNIVERSITY_DOMAIN);
  // eslint-disable-next-line no-console
  console.log('Seeded users:', SEEDED_USERS.map((u) => ({ email: u.email, role: u.role })));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
