const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const repo = require('./certificates.repository');

const STATUS_TRANSITIONS = {
  issued: new Set(['revoked', 'superseded']),
  revoked: new Set(),
  superseded: new Set(),
};

async function cohortIdsVisibleTo(requester) {
  const roles = normalizeRoles(requester.roles);
  const uni = requester.universityId;
  const or = [];
  if (roles.includes('instructor')) {
    or.push({ instructor_id: requester.userId });
  }
  if (uni && roles.some((r) => ['university_admin', 'academic_admin', 'qa_officer'].includes(r))) {
    or.push({ university_id: uni });
  }
  if (!or.length) return [];
  const rows = await prisma.cohorts.findMany({ where: { OR: or }, select: { id: true } });
  return rows.map((r) => r.id);
}

function isGlobalCertificateReader(requester) {
  const roles = normalizeRoles(requester.roles);
  return roles.includes('super_admin') || roles.includes('program_admin');
}

async function buildCertificateListWhere(query, requester) {
  const roles = normalizeRoles(requester.roles);
  const and = [];

  if (query.university_id) {
    const cohortRows = await prisma.cohorts.findMany({
      where: { university_id: query.university_id },
      select: { id: true },
    });
    const cids = cohortRows.map((c) => c.id);
    if (!cids.length) {
      and.push({ id: { in: [] } });
    } else {
      and.push({ cohort_id: { in: cids } });
    }
  }

  if (isGlobalCertificateReader(requester)) {
    // no cohort scope
  } else if (roles.includes('student')) {
    if (query.student_id && query.student_id !== requester.userId) {
      throw new ApiError(403, 'Forbidden');
    }
    and.push({ student_id: requester.userId });
  } else {
    const cohortIds = await cohortIdsVisibleTo(requester);
    if (!cohortIds.length) {
      return { id: { in: [] } };
    }
    and.push({ cohort_id: { in: cohortIds } });
  }

  if (query.student_id) and.push({ student_id: query.student_id });
  if (query.cohort_id) and.push({ cohort_id: query.cohort_id });
  if (query.micro_credential_id) and.push({ micro_credential_id: query.micro_credential_id });
  if (query.status) and.push({ status: query.status });
  if (query.search) {
    and.push({
      OR: [
        { certificate_no: { contains: query.search, mode: 'insensitive' } },
        { verification_code: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateCertificates(rows) {
  if (!rows.length) return [];
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const mcIds = [...new Set(rows.map((r) => r.micro_credential_id))];
  const [students, cohorts, mcs] = await Promise.all([
    prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, full_name: true, email: true },
    }),
    prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }),
    prisma.micro_credentials.findMany({ where: { id: { in: mcIds } } }),
  ]);
  const sMap = new Map(students.map((x) => [x.id, x]));
  const cMap = new Map(cohorts.map((x) => [x.id, x]));
  const mcMap = new Map(mcs.map((x) => [x.id, x]));
  return rows.map((r) => ({
    id: r.id,
    certificate_no: r.certificate_no,
    issued_at: r.issued_at,
    verification_code: r.verification_code,
    status: r.status,
    qr_code_url: r.qr_code_url,
    student_id: r.student_id,
    cohort_id: r.cohort_id,
    micro_credential_id: r.micro_credential_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    student: sMap.get(r.student_id) ?? null,
    cohort: cMap.get(r.cohort_id)
      ? { id: r.cohort_id, title: cMap.get(r.cohort_id).title, status: cMap.get(r.cohort_id).status }
      : null,
    micro_credential: mcMap.get(r.micro_credential_id)
      ? { id: r.micro_credential_id, title: mcMap.get(r.micro_credential_id).title, code: mcMap.get(r.micro_credential_id).code }
      : null,
  }));
}

async function assertStaffMayAccessCohort(requester, cohort) {
  if (!cohort) throw new ApiError(400, 'Invalid cohort_id');
  if (isGlobalCertificateReader(requester)) return;
  const roles = normalizeRoles(requester.roles);
  const uni = requester.universityId;
  if (roles.includes('instructor') && cohort.instructor_id === requester.userId) return;
  if (uni && roles.some((r) => ['university_admin', 'academic_admin', 'qa_officer'].includes(r)) && cohort.university_id === uni) {
    return;
  }
  throw new ApiError(403, 'Forbidden');
}

async function assertEnrollmentAndMc({ student_id, cohort_id, micro_credential_id }) {
  const cohort = await prisma.cohorts.findUnique({ where: { id: cohort_id } });
  if (!cohort) throw new ApiError(400, 'Invalid cohort_id');
  if (cohort.micro_credential_id !== micro_credential_id) {
    throw new ApiError(400, 'micro_credential_id must match the cohort micro-credential');
  }
  const enrollment = await prisma.enrollments.findFirst({
    where: {
      student_id,
      cohort_id,
      enrollment_status: { in: ['enrolled', 'completed'] },
    },
  });
  if (!enrollment) throw new ApiError(400, 'Student is not enrolled in this cohort');
  const existing = await prisma.certificates.findFirst({
    where: { student_id, cohort_id, micro_credential_id },
  });
  if (existing) throw new ApiError(409, 'Certificate already exists for this student, cohort, and micro-credential');
}

function generateCertificateNo() {
  const y = new Date().getFullYear();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BAT-${y}-${rand}`;
}

function generateVerificationCode() {
  return crypto.randomBytes(16).toString('hex');
}

async function listCertificates(query, requester) {
  const where = await buildCertificateListWhere(query, requester);
  const [total, rows] = await Promise.all([
    repo.count(where),
    repo.findMany(where, { skip: query.skip, take: query.take }),
  ]);
  const certificates = await hydrateCertificates(rows);
  const total_pages = Math.max(1, Math.ceil(total / query.page_size));
  return {
    certificates,
    meta: {
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages,
    },
  };
}

async function getCertificateById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Certificate not found');
  const where = await buildCertificateListWhere({}, requester);
  if (where.id && Array.isArray(where.id.in) && where.id.in.length === 0) {
    throw new ApiError(403, 'Forbidden');
  }
  if (Object.keys(where).length === 0) {
    const [full] = await hydrateCertificates([row]);
    return { certificate: full };
  }
  if (where.AND) {
    const match = await prisma.certificates.findFirst({
      where: { AND: [{ id }, ...where.AND] },
    });
    if (!match) throw new ApiError(403, 'Forbidden');
  }
  const [full] = await hydrateCertificates([row]);
  return { certificate: full };
}

async function verifyByCode(verificationCode) {
  const row = await repo.findByVerificationCode(verificationCode);
  if (!row) {
    return { verified: false, certificate: null };
  }
  const [cohort, mc] = await Promise.all([
    prisma.cohorts.findUnique({ where: { id: row.cohort_id } }),
    prisma.micro_credentials.findUnique({ where: { id: row.micro_credential_id } }),
  ]);
  return {
    verified: row.status === 'issued',
    certificate: {
      certificate_no: row.certificate_no,
      status: row.status,
      issued_at: row.issued_at,
      micro_credential: mc ? { title: mc.title, code: mc.code } : null,
      cohort: cohort ? { title: cohort.title } : null,
    },
  };
}

async function createCertificate(body, requester) {
  await assertEnrollmentAndMc(body);
  const cohort = await prisma.cohorts.findUnique({ where: { id: body.cohort_id } });
  await assertStaffMayAccessCohort(requester, cohort);

  let certificate_no = generateCertificateNo();
  let verification_code = generateVerificationCode();
  let created;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      created = await repo.create({
        student_id: body.student_id,
        cohort_id: body.cohort_id,
        micro_credential_id: body.micro_credential_id,
        certificate_no,
        verification_code,
        qr_code_url: body.qr_code_url ?? null,
        status: body.status && ['issued', 'revoked', 'superseded'].includes(body.status) ? body.status : 'issued',
      });
      break;
    } catch (e) {
      if (e.code === 'P2002') {
        certificate_no = generateCertificateNo();
        verification_code = generateVerificationCode();
      } else {
        throw e;
      }
    }
  }
  if (!created) throw new ApiError(500, 'Could not allocate unique certificate identifiers');
  const [full] = await hydrateCertificates([created]);
  return { certificate: full };
}

async function patchCertificateStatus(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Certificate not found');
  const cohort = await prisma.cohorts.findUnique({ where: { id: row.cohort_id } });
  await assertStaffMayAccessCohort(requester, cohort);
  if (row.status === body.status) {
    const [full] = await hydrateCertificates([row]);
    return { certificate: full };
  }
  const allowed = STATUS_TRANSITIONS[row.status];
  if (!allowed || !allowed.has(body.status)) {
    throw new ApiError(400, `Invalid certificate status transition: ${row.status} -> ${body.status}`);
  }
  const updated = await repo.update(id, { status: body.status, updated_at: new Date() });
  const [full] = await hydrateCertificates([updated]);
  return { certificate: full };
}

module.exports = {
  listCertificates,
  getCertificateById,
  verifyByCode,
  createCertificate,
  patchCertificateStatus,
};
