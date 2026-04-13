const { prisma } = require('../../config/db');

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
async function findMany(where, tx = prisma) {
  return tx.tracks.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

async function findById(id, tx = prisma) {
  return tx.tracks.findUnique({ where: { id } });
}

async function findByCode(code, tx = prisma) {
  return tx.tracks.findUnique({ where: { code: code.trim() } });
}

async function create(data, tx = prisma) {
  return tx.tracks.create({ data });
}

async function update(id, data, tx = prisma) {
  return tx.tracks.update({ where: { id }, data });
}

async function countMicroCredentialsByTrackIds(trackIds, tx = prisma) {
  if (!trackIds.length) return new Map();
  const rows = await tx.micro_credentials.groupBy({
    by: ['track_id'],
    where: { track_id: { in: trackIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.track_id, r._count._all]));
}

module.exports = {
  findMany,
  findById,
  findByCode,
  create,
  update,
  countMicroCredentialsByTrackIds,
};
