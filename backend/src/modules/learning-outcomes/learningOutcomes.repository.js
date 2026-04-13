const { prisma } = require('../../config/db');

async function findByMicroCredentialId(microCredentialId, tx = prisma) {
  return tx.learning_outcomes.findMany({
    where: { micro_credential_id: microCredentialId },
    orderBy: { outcome_code: 'asc' },
  });
}

async function findById(id, tx = prisma) {
  return tx.learning_outcomes.findUnique({ where: { id } });
}

async function countByMicroCredentialId(microCredentialId, tx = prisma) {
  return tx.learning_outcomes.count({ where: { micro_credential_id: microCredentialId } });
}

async function create(data, tx = prisma) {
  return tx.learning_outcomes.create({ data });
}

async function update(id, data, tx = prisma) {
  return tx.learning_outcomes.update({ where: { id }, data });
}

async function remove(id, tx = prisma) {
  return tx.learning_outcomes.delete({ where: { id } });
}

module.exports = {
  findByMicroCredentialId,
  findById,
  countByMicroCredentialId,
  create,
  update,
  remove,
};
