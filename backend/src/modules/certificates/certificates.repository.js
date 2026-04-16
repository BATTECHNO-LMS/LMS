const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('../analytics/prismaMissingTable.js');

async function count(where) {
  try {
    return await prisma.certificates.count({ where });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) return 0;
    throw e;
  }
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  try {
    return await prisma.certificates.findMany({
      where,
      orderBy: { issued_at: 'desc' },
      skip,
      take,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) return [];
    throw e;
  }
}

async function findById(id) {
  try {
    return await prisma.certificates.findUnique({ where: { id } });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) return null;
    throw e;
  }
}

async function findByVerificationCode(verificationCode) {
  try {
    return await prisma.certificates.findUnique({ where: { verification_code: verificationCode } });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) return null;
    throw e;
  }
}

async function findByCertificateNo(certificateNo) {
  try {
    return await prisma.certificates.findUnique({ where: { certificate_no: certificateNo } });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) return null;
    throw e;
  }
}

async function create(data) {
  try {
    return await prisma.certificates.create({ data });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) {
      const err = new Error('Certificates table is missing. Apply Prisma migrations (certificates).');
      err.code = 'CERTIFICATES_TABLE_MISSING';
      throw err;
    }
    throw e;
  }
}

async function update(id, data) {
  try {
    return await prisma.certificates.update({ where: { id }, data });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'certificates')) {
      const err = new Error('Certificates table is missing. Apply Prisma migrations (certificates).');
      err.code = 'CERTIFICATES_TABLE_MISSING';
      throw err;
    }
    throw e;
  }
}

module.exports = {
  count,
  findMany,
  findById,
  findByVerificationCode,
  findByCertificateNo,
  create,
  update,
};
