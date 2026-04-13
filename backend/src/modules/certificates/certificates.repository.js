const { prisma } = require('../../config/db');

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.certificates.findMany({
    where,
    orderBy: { issued_at: 'desc' },
    skip,
    take,
  });
}

async function findById(id) {
  return prisma.certificates.findUnique({ where: { id } });
}

async function findByVerificationCode(verificationCode) {
  return prisma.certificates.findUnique({ where: { verification_code: verificationCode } });
}

async function findByCertificateNo(certificateNo) {
  return prisma.certificates.findUnique({ where: { certificate_no: certificateNo } });
}

async function create(data) {
  return prisma.certificates.create({ data });
}

async function update(id, data) {
  return prisma.certificates.update({ where: { id }, data });
}

module.exports = {
  findMany,
  findById,
  findByVerificationCode,
  findByCertificateNo,
  create,
  update,
};
