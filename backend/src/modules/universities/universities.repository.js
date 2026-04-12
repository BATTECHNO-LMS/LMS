const { prisma } = require('../../config/db');

const listSelect = {
  id: true,
  name: true,
  type: true,
  contact_person: true,
  contact_email: true,
  contact_phone: true,
  status: true,
  partnership_state: true,
  notes: true,
};

async function findAllOrdered() {
  return prisma.universities.findMany({
    select: listSelect,
    orderBy: { name: 'asc' },
  });
}

async function findById(id) {
  return prisma.universities.findFirst({
    where: { id },
    select: listSelect,
  });
}

async function findByName(name) {
  return prisma.universities.findFirst({
    where: { name },
    select: { id: true },
  });
}

async function countLinkedUsers(universityId) {
  return prisma.university_users.count({
    where: { university_id: universityId },
  });
}

async function countLinkedMicroCredentials(universityId) {
  return prisma.micro_credential_universities.count({
    where: { university_id: universityId },
  });
}

async function createUniversity(data) {
  return prisma.universities.create({
    data,
    select: listSelect,
  });
}

async function updateUniversity(id, data) {
  return prisma.universities.update({
    where: { id },
    data,
    select: listSelect,
  });
}

module.exports = {
  findAllOrdered,
  findById,
  findByName,
  countLinkedUsers,
  countLinkedMicroCredentials,
  createUniversity,
  updateUniversity,
};
