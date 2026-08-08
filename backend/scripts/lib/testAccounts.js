const { prisma } = require('../../src/config/db');
const { hashPassword } = require('../../src/utils/password');
const { ensureRoles, ensureSpecialties } = require('./realBaseline');
const reviewerAssignment = require('../../src/modules/users/reviewerAssignment.service');
const {
  BATUNI_TEST_UNIVERSITY,
  TEST_PASSWORD,
  TEST_ACCOUNT_USERS,
  buildTestUniversityNotes,
  relationshipTypeForRole,
} = require('./testAccountsCatalog');

async function findUniversityByDomain(domain) {
  const normalized = String(domain).trim().toLowerCase();
  const domainRow = await prisma.university_email_domains.findFirst({
    where: { domain: normalized },
    select: { university_id: true },
  });
  if (!domainRow) return null;
  return prisma.universities.findUnique({ where: { id: domainRow.university_id } });
}

async function ensureBatuniUniversity() {
  const spec = BATUNI_TEST_UNIVERSITY;
  const domain = spec.domain.toLowerCase();
  let existing = await findUniversityByDomain(domain);
  if (!existing) {
    existing = await prisma.universities.findFirst({ where: { name: spec.name } });
  }

  const data = {
    name: spec.name,
    type: 'University',
    contact_person: 'إدارة المنصة',
    contact_email: spec.contact_email,
    contact_phone: null,
    status: 'active',
    partnership_state: 'active',
    notes: buildTestUniversityNotes(spec),
  };

  const university = existing
    ? await prisma.universities.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date() },
      })
    : await prisma.universities.create({ data });

  const domainRow = await prisma.university_email_domains.findFirst({
    where: { university_id: university.id, domain },
  });
  if (domainRow) {
    await prisma.university_email_domains.update({
      where: { id: domainRow.id },
      data: { is_active: true, updated_at: new Date() },
    });
  } else {
    await prisma.university_email_domains.create({
      data: { university_id: university.id, domain, is_active: true },
    });
  }

  return { university, domain };
}

async function ensureBatuniUniversitySpecialty(universityId, specialtyId) {
  if (!specialtyId) return null;
  const existing = await prisma.university_specialties.findFirst({
    where: { university_id: universityId, code: 'CYBERSECURITY' },
  });
  if (existing) {
    return prisma.university_specialties.update({
      where: { id: existing.id },
      data: {
        specialty_id: specialtyId,
        name_ar: 'الأمن السيبراني',
        name_en: 'Cybersecurity',
        status: 'active',
        updated_at: new Date(),
      },
    });
  }
  return prisma.university_specialties.create({
    data: {
      university_id: universityId,
      specialty_id: specialtyId,
      name_ar: 'الأمن السيبراني',
      name_en: 'Cybersecurity',
      code: 'CYBERSECURITY',
      college_name_ar: 'كلية تكنولوجيا المعلومات',
      college_name_en: 'College of Information Technology',
      status: 'active',
    },
  });
}

async function ensureTestUser({
  email,
  full_name,
  roleCode,
  passwordHash,
  universityId,
  specialtyId,
  universitySpecialtyId,
  roleByCode,
}) {
  const role = roleByCode.get(roleCode);
  if (!role) {
    throw new Error(`Missing role: ${roleCode}`);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const user = await prisma.users.upsert({
    where: { email: normalizedEmail },
    update: {
      full_name,
      password_hash: passwordHash,
      status: 'active',
      primary_university_id: universityId,
      specialty_id: specialtyId,
      university_specialty_id: universitySpecialtyId ?? null,
      email_verified_at: now,
      activated_at: now,
      updated_at: now,
    },
    create: {
      full_name,
      email: normalizedEmail,
      password_hash: passwordHash,
      status: 'active',
      primary_university_id: universityId,
      specialty_id: specialtyId,
      university_specialty_id: universitySpecialtyId ?? null,
      email_verified_at: now,
      activated_at: now,
    },
  });

  await prisma.user_roles.deleteMany({
    where: { user_id: user.id, role_id: { not: role.id } },
  });

  const roleLink = await prisma.user_roles.findFirst({
    where: { user_id: user.id, role_id: role.id },
    select: { id: true },
  });
  if (!roleLink) {
    await prisma.user_roles.create({
      data: { user_id: user.id, role_id: role.id },
    });
  }

  const relType = relationshipTypeForRole(roleCode);
  const uniLink = await prisma.university_users.findFirst({
    where: { university_id: universityId, user_id: user.id },
    select: { id: true },
  });
  if (!uniLink) {
    await prisma.university_users.create({
      data: {
        university_id: universityId,
        user_id: user.id,
        relationship_type: relType,
      },
    });
  } else {
    await prisma.university_users.update({
      where: { id: uniLink.id },
      data: { relationship_type: relType, updated_at: now },
    });
  }

  // Reviewer scope is assignment-table authoritative (not primary_university_id alone).
  if (roleCode === 'reviewer') {
    await reviewerAssignment.assignReviewerUniversity({
      reviewerUserId: user.id,
      universityId,
      source: 'MANUAL',
      assignedById: null,
    });
  }

  return user;
}

/**
 * Idempotent dev/staging test accounts seed.
 * Does not delete any data.
 */
async function seedTestAccounts({ log = console.log } = {}) {
  const roles = await ensureRoles();
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  for (const role of roles) {
    log(`Ensured role: ${role.code}`);
  }

  const specialtiesByCode = await ensureSpecialties();
  const { university, domain } = await ensureBatuniUniversity();
  const cysSpecialty = specialtiesByCode.get('CYB');
  const batuniUniversitySpecialty = cysSpecialty
    ? await ensureBatuniUniversitySpecialty(university.id, cysSpecialty.id)
    : null;
  log(`Upserted university: ${university.name} / ${domain}`);
  log(`Upserted domain: ${domain}`);

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const users = [];

  for (const account of TEST_ACCOUNT_USERS) {
    const specialtyId =
      account.specialtyCode && specialtiesByCode.has(account.specialtyCode)
        ? specialtiesByCode.get(account.specialtyCode).id
        : null;

    const user = await ensureTestUser({
      email: account.email,
      full_name: account.full_name,
      roleCode: account.role,
      passwordHash,
      universityId: university.id,
      specialtyId,
      universitySpecialtyId:
        account.role === 'student' ? batuniUniversitySpecialty?.id ?? null : null,
      roleByCode,
    });

    users.push({
      email: user.email,
      role: account.role,
      status: user.status,
      verified: Boolean(user.email_verified_at),
    });

    log(`Upserted user: ${user.email} / ${account.role} / active / verified`);
  }

  return { university, domain, users };
}

module.exports = { seedTestAccounts, ensureBatuniUniversity, ensureTestUser };
