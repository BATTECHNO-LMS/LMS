const { ApiError } = require('../../utils/apiError');
const { resolveScopedCohortIds, cohortIdInScope } = require('../../utils/cohortScope');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const { prisma } = require('../../config/db');
const repo = require('./integrityCases.repository');

const INTEGRITY_STATUS_FLOW = {
  reported: new Set(['under_investigation', 'resolved', 'closed']),
  under_investigation: new Set(['reported', 'resolved', 'closed']),
  resolved: new Set(['closed', 'under_investigation']),
  closed: new Set(),
};

function assertIntegrityStatusTransition(from, to) {
  const allowed = INTEGRITY_STATUS_FLOW[from];
  if (!allowed || !allowed.has(to)) {
    throw new ApiError(400, `Invalid integrity case status transition: ${from} -> ${to}`);
  }
}

async function buildListWhere(query, scopeIds) {
  const and = [];
  if (scopeIds !== null) {
    if (!scopeIds.length) return { id: { in: [] } };
    and.push({ cohort_id: { in: scopeIds } });
  }
  if (query.cohort_id) and.push({ cohort_id: query.cohort_id });
  if (query.student_id) and.push({ student_id: query.student_id });
  if (query.assessment_id) and.push({ assessment_id: query.assessment_id });
  if (query.case_type) and.push({ case_type: query.case_type });
  if (query.status) and.push({ status: query.status });
  if (query.search) {
    and.push({
      OR: [
        { evidence_notes: { contains: query.search, mode: 'insensitive' } },
        { decision: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateIntegrityRows(rows) {
  if (!rows.length) return [];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const assessmentIds = [...new Set(rows.map((r) => r.assessment_id).filter(Boolean))];
  const reporterIds = [...new Set(rows.map((r) => r.reported_by).filter(Boolean))];
  const [cohorts, students, assessments, reporters] = await Promise.all([
    prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }),
    prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, full_name: true, email: true },
    }),
    assessmentIds.length
      ? prisma.assessments.findMany({ where: { id: { in: assessmentIds } }, select: { id: true, title: true, cohort_id: true } })
      : [],
    reporterIds.length
      ? prisma.users.findMany({
          where: { id: { in: reporterIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [],
  ]);
  const cMap = new Map(cohorts.map((c) => [c.id, c]));
  const sMap = new Map(students.map((s) => [s.id, s]));
  const aMap = new Map(assessments.map((a) => [a.id, a]));
  const rMap = new Map(reporters.map((x) => [x.id, x]));
  return rows.map((row) => {
    const c = cMap.get(row.cohort_id);
    const st = sMap.get(row.student_id);
    const as = row.assessment_id ? aMap.get(row.assessment_id) : null;
    const rep = row.reported_by ? rMap.get(row.reported_by) : null;
    return {
      id: row.id,
      cohort_id: row.cohort_id,
      student_id: row.student_id,
      assessment_id: row.assessment_id,
      reported_by: row.reported_by,
      case_type: row.case_type,
      evidence_notes: row.evidence_notes,
      decision: row.decision,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cohort: c ? { id: c.id, title: c.title, status: c.status } : null,
      student: st ? { id: st.id, full_name: st.full_name, email: st.email } : null,
      assessment: as ? { id: as.id, title: as.title, cohort_id: as.cohort_id } : null,
      reported_by_user: rep ? { id: rep.id, full_name: rep.full_name, email: rep.email } : null,
    };
  });
}

async function assertIntegrityAccess(requester, cohortId) {
  const cohort = await cohortsRepo.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Integrity case not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
}

async function assertStudentInCohort(cohortId, studentId) {
  const en = await enrollmentsRepo.findByCohortAndStudent(cohortId, studentId);
  if (!en || !['pending', 'enrolled', 'completed'].includes(en.enrollment_status)) {
    throw new ApiError(400, 'student_id must be enrolled in the cohort');
  }
}

async function assertAssessmentInCohort(assessmentId, cohortId) {
  const a = await prisma.assessments.findFirst({ where: { id: assessmentId, cohort_id: cohortId } });
  if (!a) throw new ApiError(400, 'assessment_id must belong to the same cohort');
}

async function listIntegrityCases(query, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (query.cohort_id && !cohortIdInScope(scopeIds, query.cohort_id)) throw new ApiError(403, 'Forbidden');
  const where = await buildListWhere(query, scopeIds);
  const rows = await repo.findMany(where, { take: 200 });
  const integrity_cases = await hydrateIntegrityRows(rows);
  return { integrity_cases };
}

async function getIntegrityCaseById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Integrity case not found');
  await assertIntegrityAccess(requester, row.cohort_id);
  const [full] = await hydrateIntegrityRows([row]);
  return { integrity_case: full };
}

async function createIntegrityCase(body, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (!cohortIdInScope(scopeIds, body.cohort_id)) throw new ApiError(403, 'Forbidden');
  await assertIntegrityAccess(requester, body.cohort_id);
  await assertStudentInCohort(body.cohort_id, body.student_id);
  if (body.assessment_id) await assertAssessmentInCohort(body.assessment_id, body.cohort_id);
  if (body.reported_by) {
    const u = await cohortsRepo.findUser(body.reported_by);
    if (!u) throw new ApiError(400, 'Invalid reported_by');
  }

  const allowedOnCreate = new Set(['reported', 'under_investigation']);
  const status = body.status && allowedOnCreate.has(body.status) ? body.status : 'reported';

  const created = await repo.create({
    cohort_id: body.cohort_id,
    student_id: body.student_id,
    assessment_id: body.assessment_id ?? null,
    reported_by: body.reported_by ?? null,
    case_type: body.case_type,
    evidence_notes: body.evidence_notes ?? null,
    decision: body.decision ?? null,
    status,
  });
  const [full] = await hydrateIntegrityRows([created]);
  return { integrity_case: full };
}

async function updateIntegrityCase(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Integrity case not found');
  await assertIntegrityAccess(requester, row.cohort_id);

  const nextAssessmentId = body.assessment_id !== undefined ? body.assessment_id : row.assessment_id;
  if (nextAssessmentId) await assertAssessmentInCohort(nextAssessmentId, row.cohort_id);

  if (body.reported_by) {
    const u = await cohortsRepo.findUser(body.reported_by);
    if (!u) throw new ApiError(400, 'Invalid reported_by');
  }

  const data = { updated_at: new Date() };
  if (body.assessment_id !== undefined) data.assessment_id = body.assessment_id;
  if (body.reported_by !== undefined) data.reported_by = body.reported_by;
  if (body.evidence_notes !== undefined) data.evidence_notes = body.evidence_notes;
  if (body.decision !== undefined) data.decision = body.decision;
  if (body.status !== undefined) {
    assertIntegrityStatusTransition(row.status, body.status);
    data.status = body.status;
  }

  const updated = await repo.update(id, data);
  const [full] = await hydrateIntegrityRows([updated]);
  return { integrity_case: full };
}

async function patchIntegrityCaseStatus(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Integrity case not found');
  await assertIntegrityAccess(requester, row.cohort_id);
  assertIntegrityStatusTransition(row.status, body.status);
  const updated = await repo.update(id, { status: body.status, updated_at: new Date() });
  const [full] = await hydrateIntegrityRows([updated]);
  return { integrity_case: full };
}

module.exports = {
  listIntegrityCases,
  getIntegrityCaseById,
  createIntegrityCase,
  updateIntegrityCase,
  patchIntegrityCaseStatus,
};
