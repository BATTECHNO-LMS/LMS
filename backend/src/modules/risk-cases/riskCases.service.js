const { ApiError } = require('../../utils/apiError');
const { resolveScopedCohortIds, cohortIdInScope } = require('../../utils/cohortScope');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const { prisma } = require('../../config/db');
const repo = require('./riskCases.repository');

const RISK_STATUS_FLOW = {
  open: new Set(['in_progress', 'resolved', 'closed', 'escalated']),
  in_progress: new Set(['open', 'resolved', 'closed', 'escalated']),
  escalated: new Set(['open', 'in_progress', 'resolved', 'closed']),
  resolved: new Set(['closed', 'in_progress']),
  closed: new Set(),
};

function assertRiskStatusTransition(from, to) {
  const allowed = RISK_STATUS_FLOW[from];
  if (!allowed || !allowed.has(to)) {
    throw new ApiError(400, `Invalid risk case status transition: ${from} -> ${to}`);
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
  if (query.risk_type) and.push({ risk_type: query.risk_type });
  if (query.risk_level) and.push({ risk_level: query.risk_level });
  if (query.status) and.push({ status: query.status });
  if (query.search) {
    and.push({ action_plan: { contains: query.search, mode: 'insensitive' } });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateRiskRows(rows) {
  if (!rows.length) return [];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const openerIds = [...new Set(rows.map((r) => r.opened_by).filter(Boolean))];
  const [cohorts, students, openers] = await Promise.all([
    prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }),
    prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, full_name: true, email: true },
    }),
    openerIds.length
      ? prisma.users.findMany({
          where: { id: { in: openerIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [],
  ]);
  const cMap = new Map(cohorts.map((c) => [c.id, c]));
  const sMap = new Map(students.map((s) => [s.id, s]));
  const oMap = new Map(openers.map((o) => [o.id, o]));
  return rows.map((r) => {
    const c = cMap.get(r.cohort_id);
    const st = sMap.get(r.student_id);
    const op = r.opened_by ? oMap.get(r.opened_by) : null;
    return {
      id: r.id,
      cohort_id: r.cohort_id,
      student_id: r.student_id,
      risk_type: r.risk_type,
      risk_level: r.risk_level,
      opened_by: r.opened_by,
      action_plan: r.action_plan,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      cohort: c ? { id: c.id, title: c.title, status: c.status } : null,
      student: st ? { id: st.id, full_name: st.full_name, email: st.email } : null,
      opened_by_user: op ? { id: op.id, full_name: op.full_name, email: op.email } : null,
    };
  });
}

async function assertRiskAccess(requester, cohortId) {
  const cohort = await cohortsRepo.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Risk case not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
}

async function assertStudentInCohort(cohortId, studentId) {
  const en = await enrollmentsRepo.findByCohortAndStudent(cohortId, studentId);
  if (!en || !['pending', 'enrolled', 'completed'].includes(en.enrollment_status)) {
    throw new ApiError(400, 'student_id must be enrolled in the cohort');
  }
}

async function listRiskCases(query, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (query.cohort_id && !cohortIdInScope(scopeIds, query.cohort_id)) throw new ApiError(403, 'Forbidden');
  const where = await buildListWhere(query, scopeIds);
  const rows = await repo.findMany(where, { take: 200 });
  const risk_cases = await hydrateRiskRows(rows);
  return { risk_cases };
}

async function getRiskCaseById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Risk case not found');
  await assertRiskAccess(requester, row.cohort_id);
  const [full] = await hydrateRiskRows([row]);
  return { risk_case: full };
}

async function createRiskCase(body, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (!cohortIdInScope(scopeIds, body.cohort_id)) throw new ApiError(403, 'Forbidden');
  await assertRiskAccess(requester, body.cohort_id);
  await assertStudentInCohort(body.cohort_id, body.student_id);

  if (body.opened_by) {
    const u = await cohortsRepo.findUser(body.opened_by);
    if (!u) throw new ApiError(400, 'Invalid opened_by');
  }

  const dup = await repo.countOpenByTypeStudentCohort(body.cohort_id, body.student_id, body.risk_type);
  if (dup > 0) {
    throw new ApiError(400, 'An open risk case of this type already exists for this student in this cohort');
  }

  const allowedOnCreate = new Set(['open', 'in_progress', 'escalated']);
  const status = body.status && allowedOnCreate.has(body.status) ? body.status : 'open';

  const created = await repo.create({
    cohort_id: body.cohort_id,
    student_id: body.student_id,
    risk_type: body.risk_type,
    risk_level: body.risk_level,
    opened_by: body.opened_by ?? null,
    action_plan: body.action_plan ?? null,
    status,
  });
  const [full] = await hydrateRiskRows([created]);
  return { risk_case: full };
}

async function updateRiskCase(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Risk case not found');
  await assertRiskAccess(requester, row.cohort_id);

  if (body.opened_by) {
    const u = await cohortsRepo.findUser(body.opened_by);
    if (!u) throw new ApiError(400, 'Invalid opened_by');
  }

  const data = { updated_at: new Date() };
  if (body.risk_level !== undefined) data.risk_level = body.risk_level;
  if (body.opened_by !== undefined) data.opened_by = body.opened_by;
  if (body.action_plan !== undefined) data.action_plan = body.action_plan;
  if (body.status !== undefined) {
    assertRiskStatusTransition(row.status, body.status);
    data.status = body.status;
  }

  const updated = await repo.update(id, data);
  const [full] = await hydrateRiskRows([updated]);
  return { risk_case: full };
}

async function patchRiskCaseStatus(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Risk case not found');
  await assertRiskAccess(requester, row.cohort_id);
  assertRiskStatusTransition(row.status, body.status);
  const updated = await repo.update(id, { status: body.status, updated_at: new Date() });
  const [full] = await hydrateRiskRows([updated]);
  return { risk_case: full };
}

module.exports = {
  listRiskCases,
  getRiskCaseById,
  createRiskCase,
  updateRiskCase,
  patchRiskCaseStatus,
};
