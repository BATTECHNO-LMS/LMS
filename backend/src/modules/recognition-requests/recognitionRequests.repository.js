const { prisma } = require('../../config/db');

async function count(where) {
  return prisma.recognition_requests.count({ where });
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.recognition_requests.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });
}

async function findById(id) {
  return prisma.recognition_requests.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.recognition_requests.create({ data });
}

async function update(id, data) {
  return prisma.recognition_requests.update({ where: { id }, data });
}

async function countDocuments(requestId) {
  return prisma.recognition_documents.count({ where: { recognition_request_id: requestId } });
}

async function hasDocumentType(requestId, documentType) {
  const n = await prisma.recognition_documents.count({
    where: { recognition_request_id: requestId, document_type: documentType },
  });
  return n > 0;
}

module.exports = { count, findMany, findById, create, update, countDocuments, hasDocumentType };
