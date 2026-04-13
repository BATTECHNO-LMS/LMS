const { ApiError } = require('../../utils/apiError');
const { resolveScopedCohortIds, cohortIdInScope } = require('../../utils/cohortScope');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const { prisma } = require('../../config/db');
const repo = require('./evidence.repository');

async function assertEvidenceLinks(body) {
  const cohort = await cohortsRepo.findById(body.cohort_id);
  if (!cohort) throw new ApiError(400, 'Invalid cohort_id');
  if (cohort.micro_credential_id !== body.micro_credential_id) {
    throw new ApiError(400, 'micro_credential_id must match the cohort micro-credential');
  }

  if (body.student_id) {
    const en = await enrollmentsRepo.findByCohortAndStudent(body.cohort_id, body.student_id);
    if (!en || !['pending', 'enrolled', 'completed'].includes(en.enrollment_status)) {
      throw new ApiError(400, 'student_id must be enrolled in the cohort');
    }
  }

  if (body.assessment_id) {
    const a = await prisma.assessments.findFirst({
      where: { id: body.assessment_id, cohort_id: body.cohort_id },
    });
    if (!a) throw new ApiError(400, 'assessment_id must belong to the cohort');
    if (a.micro_credential_id !== body.micro_credential_id) {
      throw new ApiError(400, 'assessment must align with the cohort micro-credential');
    }
  }

  if (body.session_id) {
    const s = await prisma.sessions.findFirst({
      where: { id: body.session_id, cohort_id: body.cohort_id },
    });
    if (!s) throw new ApiError(400, 'session_id must belong to the cohort');
  }

}

async function buildListWhere(query, scopeIds) {
  const and = [];
  if (scopeIds !== null) {
    if (!scopeIds.length) return { id: { in: [] } };
    and.push({ cohort_id: { in: scopeIds } });
  }
  if (query.micro_credential_id) and.push({ micro_credential_id: query.micro_credential_id });
  if (query.cohort_id) and.push({ cohort_id: query.cohort_id });
  if (query.student_id) and.push({ student_id: query.student_id });
  if (query.assessment_id) and.push({ assessment_id: query.assessment_id });
  if (query.session_id) and.push({ session_id: query.session_id });
  if (query.evidence_type) and.push({ evidence_type: query.evidence_type });
  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { evidence_type: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateRows(rows) {
  if (!rows.length) return [];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const mcIds = [...new Set(rows.map((r) => r.micro_credential_id))];
  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
  const assessmentIds = [...new Set(rows.map((r) => r.assessment_id).filter(Boolean))];
  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))];
  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by).filter(Boolean))];

  const [cohorts, mcs, students, assessments, sessions, uploaders] = await Promise.all([
    prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }),
    prisma.micro_credentials.findMany({ where: { id: { in: mcIds } } }),
    studentIds.length
      ? prisma.users.findMany({ where: { id: { in: studentIds } }, select: { id: true, full_name: true, email: true } })
      : [],
    assessmentIds.length
      ? prisma.assessments.findMany({ where: { id: { in: assessmentIds } }, select: { id: true, title: true } })
      : [],
    sessionIds.length
      ? prisma.sessions.findMany({ where: { id: { in: sessionIds } }, select: { id: true, title: true } })
      : [],
    uploaderIds.length
      ? prisma.users.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, full_name: true, email: true } })
      : [],
  ]);

  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const mcMap = new Map(mcs.map((m) => [m.id, m]));
  const studentMap = new Map(students.map((u) => [u.id, u]));
  const assessmentMap = new Map(assessments.map((a) => [a.id, a]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u]));

  return rows.map((r) => {
    const c = cohortMap.get(r.cohort_id);
    const mc = mcMap.get(r.micro_credential_id);
    const st = r.student_id ? studentMap.get(r.student_id) : null;
    const as = r.assessment_id ? assessmentMap.get(r.assessment_id) : null;
    const se = r.session_id ? sessionMap.get(r.session_id) : null;
    const up = r.uploaded_by ? uploaderMap.get(r.uploaded_by) : null;
    return {
      id: r.id,
      title: r.title,
      evidence_type: r.evidence_type,
      file_url: r.file_url,
      micro_credential_id: r.micro_credential_id,
      cohort_id: r.cohort_id,
      student_id: r.student_id,
      assessment_id: r.assessment_id,
      session_id: r.session_id,
      uploaded_by: r.uploaded_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      micro_credential: mc ? { id: mc.id, title: mc.title, code: mc.code, status: mc.status } : null,
      cohort: c ? { id: c.id, title: c.title, status: c.status } : null,
      student: st ? { id: st.id, full_name: st.full_name, email: st.email } : null,
      assessment: as ? { id: as.id, title: as.title } : null,
      session: se ? { id: se.id, title: se.title } : null,
      uploaded_by_user: up ? { id: up.id, full_name: up.full_name, email: up.email } : null,
    };
  });
}

async function assertCanAccessEvidence(requester, cohortId) {
  const cohort = await cohortsRepo.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Evidence not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
}

async function listEvidence(query, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  const where = await buildListWhere(query, scopeIds);
  const rows = await repo.findMany(where, { take: 200 });
  const evidence = await hydrateRows(rows);
  return { evidence };
}

async function getEvidenceById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Evidence not found');
  await assertCanAccessEvidence(requester, row.cohort_id);
  const [full] = await hydrateRows([row]);
  return { evidence: full };
}

async function createEvidence(body, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (!cohortIdInScope(scopeIds, body.cohort_id)) throw new ApiError(403, 'Forbidden');
  await assertCanAccessEvidence(requester, body.cohort_id);
  await assertEvidenceLinks(body);

  const uploadedBy = body.uploaded_by ?? requester.userId;
  if (body.uploaded_by) {
    const u = await cohortsRepo.findUser(body.uploaded_by);
    if (!u) throw new ApiError(400, 'Invalid uploaded_by');
  }

  const created = await repo.create({
    micro_credential_id: body.micro_credential_id,
    cohort_id: body.cohort_id,
    student_id: body.student_id ?? null,
    assessment_id: body.assessment_id ?? null,
    session_id: body.session_id ?? null,
    evidence_type: body.evidence_type,
    file_url: body.file_url,
    title: body.title,
    uploaded_by: uploadedBy,
  });
  const [full] = await hydrateRows([created]);
  return { evidence: full };
}

async function updateEvidence(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Evidence not found');
  await assertCanAccessEvidence(requester, row.cohort_id);

  const next = {
    micro_credential_id: row.micro_credential_id,
    cohort_id: row.cohort_id,
    student_id: body.student_id !== undefined ? body.student_id : row.student_id,
    assessment_id: body.assessment_id !== undefined ? body.assessment_id : row.assessment_id,
    session_id: body.session_id !== undefined ? body.session_id : row.session_id,
    evidence_type: body.evidence_type ?? row.evidence_type,
    file_url: body.file_url ?? row.file_url,
    title: body.title ?? row.title,
    uploaded_by: body.uploaded_by !== undefined ? body.uploaded_by : row.uploaded_by,
  };

  if (body.uploaded_by) {
    const u = await cohortsRepo.findUser(body.uploaded_by);
    if (!u) throw new ApiError(400, 'Invalid uploaded_by');
  }

  await assertEvidenceLinks({
    micro_credential_id: next.micro_credential_id,
    cohort_id: next.cohort_id,
    student_id: next.student_id,
    assessment_id: next.assessment_id,
    session_id: next.session_id,
  });

  const updated = await repo.update(id, {
    title: next.title,
    evidence_type: next.evidence_type,
    file_url: next.file_url,
    student_id: next.student_id,
    assessment_id: next.assessment_id,
    session_id: next.session_id,
    uploaded_by: next.uploaded_by,
    updated_at: new Date(),
  });
  const [full] = await hydrateRows([updated]);
  return { evidence: full };
}

module.exports = {
  listEvidence,
  getEvidenceById,
  createEvidence,
  updateEvidence,
};
