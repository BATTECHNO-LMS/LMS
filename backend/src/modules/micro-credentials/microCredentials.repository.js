const { prisma } = require('../../config/db');

async function findById(id, tx = prisma) {
  return tx.micro_credentials.findUnique({ where: { id } });
}

async function findByCode(code, tx = prisma) {
  return tx.micro_credentials.findUnique({ where: { code: code.trim() } });
}

async function findMany(where, tx = prisma) {
  return tx.micro_credentials.findMany({
    where,
    orderBy: { title: 'asc' },
  });
}

async function create(data, tx = prisma) {
  return tx.micro_credentials.create({ data });
}

async function update(id, data, tx = prisma) {
  return tx.micro_credentials.update({ where: { id }, data });
}

async function findUniversityLinks(microCredentialId, tx = prisma) {
  return tx.micro_credential_universities.findMany({
    where: { micro_credential_id: microCredentialId },
    select: { university_id: true },
  });
}

async function replaceUniversityLinks(microCredentialId, universityIds, tx = prisma) {
  await tx.micro_credential_universities.deleteMany({ where: { micro_credential_id: microCredentialId } });
  if (!universityIds.length) return;
  await tx.micro_credential_universities.createMany({
    data: universityIds.map((university_id) => ({
      micro_credential_id: microCredentialId,
      university_id,
    })),
    skipDuplicates: true,
  });
}

async function findMicroCredentialIdsForUniversity(universityId, tx = prisma) {
  const rows = await tx.micro_credential_universities.findMany({
    where: { university_id: universityId },
    select: { micro_credential_id: true },
  });
  return [...new Set(rows.map((r) => r.micro_credential_id))];
}

async function findTrackById(id, tx = prisma) {
  return tx.tracks.findUnique({ where: { id } });
}

module.exports = {
  findById,
  findByCode,
  findMany,
  create,
  update,
  findUniversityLinks,
  replaceUniversityLinks,
  findMicroCredentialIdsForUniversity,
  findTrackById,
};
