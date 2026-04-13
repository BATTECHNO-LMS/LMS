const { ApiError } = require('../../utils/apiError');
const { resolveScopedCohortIds, cohortIdInScope } = require('../../utils/cohortScope');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const { prisma } = require('../../config/db');
const repo = require('./qaReviews.repository');

const QA_STATUS_FLOW = {
  open: new Set(['in_progress', 'resolved', 'closed']),
  in_progress: new Set(['open', 'resolved', 'closed']),
  resolved: new Set(['closed', 'in_progress']),
  closed: new Set(),
};

function assertQaStatusTransition(from, to) {
  const allowed = QA_STATUS_FLOW[from];
  if (!allowed || !allowed.has(to)) {
    throw new ApiError(400, `Invalid QA review status transition: ${from} -> ${to}`);
  }
}

function parseDateOnly(str) {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid review_date');
  return d;
}

async function buildListWhere(query, scopeIds) {
  const and = [];
  if (scopeIds !== null) {
    if (!scopeIds.length) return { id: { in: [] } };
    and.push({ cohort_id: { in: scopeIds } });
  }
  if (query.cohort_id) and.push({ cohort_id: query.cohort_id });
  if (query.reviewer_id) and.push({ reviewer_id: query.reviewer_id });
  if (query.review_type) and.push({ review_type: query.review_type });
  if (query.status) and.push({ status: query.status });
  if (query.search) {
    and.push({
      OR: [
        { findings: { contains: query.search, mode: 'insensitive' } },
        { action_required: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateQaRows(rows) {
  if (!rows.length) return [];
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const reviewerIds = [...new Set(rows.map((r) => r.reviewer_id).filter(Boolean))];
  const [cohorts, reviewers] = await Promise.all([
    cohortIds.length ? prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }) : [],
    reviewerIds.length
      ? prisma.users.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [],
  ]);
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const revMap = new Map(reviewers.map((u) => [u.id, u]));
  return rows.map((r) => {
    const c = cohortMap.get(r.cohort_id);
    const rev = r.reviewer_id ? revMap.get(r.reviewer_id) : null;
    return {
      id: r.id,
      cohort_id: r.cohort_id,
      reviewer_id: r.reviewer_id,
      review_date: r.review_date,
      review_type: r.review_type,
      findings: r.findings,
      action_required: r.action_required,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      cohort: c ? { id: c.id, title: c.title, status: c.status } : null,
      reviewer: rev ? { id: rev.id, full_name: rev.full_name, email: rev.email } : null,
    };
  });
}

async function mapCorrectiveSummaries(actions) {
  if (!actions.length) return [];
  const userIds = [...new Set(actions.map((a) => a.assigned_to).filter(Boolean))];
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const uMap = new Map(users.map((u) => [u.id, u]));
  return actions.map((a) => ({
    id: a.id,
    qa_review_id: a.qa_review_id,
    assigned_to: a.assigned_to,
    action_text: a.action_text,
    due_date: a.due_date,
    status: a.status,
    closed_at: a.closed_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
    assignee: a.assigned_to ? uMap.get(a.assigned_to) ?? null : null,
  }));
}

async function assertQaCohortAccess(requester, cohortId) {
  const cohort = await cohortsRepo.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'QA review not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
}

async function listQaReviews(query, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (query.cohort_id && !cohortIdInScope(scopeIds, query.cohort_id)) throw new ApiError(403, 'Forbidden');
  const where = await buildListWhere(query, scopeIds);
  const rows = await repo.findMany(where, { take: 200 });
  const qa_reviews = await hydrateQaRows(rows);
  return { qa_reviews };
}

async function getQaReviewById(id, query, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'QA review not found');
  await assertQaCohortAccess(requester, row.cohort_id);
  const [base] = await hydrateQaRows([row]);
  const out = { qa_review: base };
  if (query.include_corrective) {
    const actions = await repo.findCorrectiveByQaReview(id);
    out.corrective_actions = await mapCorrectiveSummaries(actions);
  }
  return out;
}

async function createQaReview(body, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  if (!cohortIdInScope(scopeIds, body.cohort_id)) throw new ApiError(403, 'Forbidden');
  await assertQaCohortAccess(requester, body.cohort_id);
  if (body.reviewer_id) {
    const u = await cohortsRepo.findUser(body.reviewer_id);
    if (!u) throw new ApiError(400, 'Invalid reviewer_id');
  }
  const created = await repo.create({
    cohort_id: body.cohort_id,
    reviewer_id: body.reviewer_id ?? null,
    review_date: parseDateOnly(body.review_date),
    review_type: body.review_type,
    findings: body.findings ?? null,
    action_required: body.action_required ?? null,
    status: 'open',
  });
  const [full] = await hydrateQaRows([created]);
  return { qa_review: full };
}

async function updateQaReview(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'QA review not found');
  await assertQaCohortAccess(requester, row.cohort_id);

  const data = { updated_at: new Date() };
  if (body.review_date !== undefined) data.review_date = parseDateOnly(body.review_date);
  if (body.review_type !== undefined) data.review_type = body.review_type;
  if (body.findings !== undefined) data.findings = body.findings;
  if (body.action_required !== undefined) data.action_required = body.action_required;
  if (body.reviewer_id !== undefined) {
    if (body.reviewer_id) {
      const u = await cohortsRepo.findUser(body.reviewer_id);
      if (!u) throw new ApiError(400, 'Invalid reviewer_id');
    }
    data.reviewer_id = body.reviewer_id;
  }
  if (body.status !== undefined) {
    assertQaStatusTransition(row.status, body.status);
    data.status = body.status;
  }

  const updated = await repo.update(id, data);
  const [full] = await hydrateQaRows([updated]);
  return { qa_review: full };
}

async function patchQaReviewStatus(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'QA review not found');
  await assertQaCohortAccess(requester, row.cohort_id);
  assertQaStatusTransition(row.status, body.status);
  const updated = await repo.update(id, { status: body.status, updated_at: new Date() });
  const [full] = await hydrateQaRows([updated]);
  return { qa_review: full };
}

module.exports = {
  listQaReviews,
  getQaReviewById,
  createQaReview,
  updateQaReview,
  patchQaReviewStatus,
};
