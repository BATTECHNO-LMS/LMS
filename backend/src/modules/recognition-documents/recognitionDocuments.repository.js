const { prisma } = require('../../config/db');

async function findManyByRequest(recognitionRequestId) {
  return prisma.recognition_documents.findMany({
    where: { recognition_request_id: recognitionRequestId },
    orderBy: { created_at: 'asc' },
  });
}

async function findById(id) {
  return prisma.recognition_documents.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.recognition_documents.create({ data });
}

async function update(id, data) {
  return prisma.recognition_documents.update({ where: { id }, data });
}

async function remove(id) {
  return prisma.recognition_documents.delete({ where: { id } });
}

module.exports = { findManyByRequest, findById, create, update, remove };
