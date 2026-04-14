const { prisma } = require('../../config/db');

async function countForUser(userId, where) {
  return prisma.notifications.count({
    where: { user_id: userId, ...where },
  });
}

async function findManyForUser(userId, where, { skip = 0, take = 200 } = {}) {
  return prisma.notifications.findMany({
    where: { user_id: userId, ...where },
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });
}

async function findByIdForUser(id, userId) {
  return prisma.notifications.findFirst({
    where: { id, user_id: userId },
  });
}

async function create(data) {
  return prisma.notifications.create({ data });
}

async function update(id, data) {
  return prisma.notifications.update({ where: { id }, data });
}

async function markAllReadForUser(userId) {
  return prisma.notifications.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true, updated_at: new Date() },
  });
}

module.exports = {
  countForUser,
  findManyForUser,
  findByIdForUser,
  create,
  update,
  markAllReadForUser,
};
