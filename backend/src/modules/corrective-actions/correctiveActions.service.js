const { ApiError } = require('../../utils/apiError');
const { resolveScopedCohortIds, cohortIdInScope } = require('../../utils/cohortScope');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const { prisma } = require('../../config/db');
const { dispatchAppEvent } = require('../../shared/services/eventDispatcher.service');
const repo = require('./correctiveActions.repository');

const CORRECTIVE_STATUS_FLOW = {
  open: new Set(['in_progress', 'resolved', 'closed', 'overdue']),
  overdue: new Set(['in_progress', 'resolved', 'closed', 'open']),
  in_progress: new Set(['open', 'resolved', 'closed', 'overdue']),
  resolved: new Set(['closed', 'in_progress']),
  closed: new Set(),
};

function assertCorrectiveStatusTransition(from, to) {
  const allowed = CORRECTIVE_STATUS_FLOW[from];
  if (!allowed || !allowed.has(to)) {
    throw new ApiError(400, `Invalid corrective action status transition: ${from} -> ${to}`);
  }
}

function parseDateOnly(str) {
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid due_date');
  return d;
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isOverdueAction(row) {
  if (!row?.due_date) return false;
  const due = new Date(row.due_date);
  return due < startOfTodayUtc() && ['open', 'in_progress', 'overdue'].includes(row.status);
}

async function scopedQaReviewIds(scopeIds) {
  if (scopeIds === null) return null;
  if (!scopeIds.length) return [];
  const rows = await prisma.qa_reviews.findMany({
    where: { cohort_id: { in: scopeIds } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function buildListWhere(query, scopeIds) {
  const qaScope = await scopedQaReviewIds(scopeIds);
  const and = [];

  if (qaScope !== null) {
    if (!qaScope.length) return { id: { in: [] } };
    and.push({ qa_review_id: { in: qaScope } });
  }

  if (query.qa_review_id) {
    and.push({ qa_review_id: query.qa_review_id });
    if (qaScope !== null && !qaScope.includes(query.qa_review_id)) {
      return { id: { in: [] } };
    }
  }
  if (query.assigned_to) and.push({ assigned_to: query.assigned_to });
  if (query.status) and.push({ status: query.status });
  if (query.overdue === true) {
    and.push({ due_date: { lt: startOfTodayUtc() } });
    and.push({ status: { notIn: ['resolved', 'closed'] } });
  }
  if (query.search) {
    and.push({ action_text: { contains: query.search, mode: 'insensitive' } });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateCorrective(rows) {
  if (!rows.length) return [];
  const qaIds = [...new Set(rows.map((r) => r.qa_review_id))];
  const userIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))];
  const [qaRows, users] = await Promise.all([
    prisma.qa_reviews.findMany({ where: { id: { in: qaIds } } }),
    userIds.length
      ? prisma.users.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [],
  ]);
  const cohortIds = [...new Set(qaRows.map((q) => q.cohort_id))];
  const cohorts = cohortIds.length ? await prisma.cohorts.findMany({ where: { id: { in: cohortIds } } }) : [];
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const qaMap = new Map(qaRows.map((q) => [q.id, q]));
  const uMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const qa = qaMap.get(r.qa_review_id);
    const co = qa ? cohortMap.get(qa.cohort_id) : null;
    const asg = r.assigned_to ? uMap.get(r.assigned_to) : null;
    return {
      id: r.id,
      qa_review_id: r.qa_review_id,
      assigned_to: r.assigned_to,
      action_text: r.action_text,
      due_date: r.due_date,
      status: r.status,
      closed_at: r.closed_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      qa_review: qa
        ? {
            id: qa.id,
            cohort_id: qa.cohort_id,
            review_date: qa.review_date,
            review_type: qa.review_type,
            status: qa.status,
            cohort: co ? { id: co.id, title: co.title, status: co.status } : null,
          }
        : null,
      assignee: asg ? { id: asg.id, full_name: asg.full_name, email: asg.email } : null,
    };
  });
}

async function assertCorrectiveAccess(requester, qaReviewId) {
  const qa = await repo.findQaReviewById(qaReviewId);
  if (!qa) throw new ApiError(404, 'Corrective action not found');
  const cohort = await cohortsRepo.findById(qa.cohort_id);
  if (!cohort) throw new ApiError(404, 'Corrective action not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  return qa;
}

async function listCorrectiveActions(query, requester) {
  const scopeIds = await resolveScopedCohortIds(requester);
  const where = await buildListWhere(query, scopeIds);
  const [total, rows] = await Promise.all([
    repo.count(where),
    repo.findMany(where, { skip: query.skip, take: query.take }),
  ]);
  const corrective_actions = await hydrateCorrective(rows);
  const total_pages = Math.max(1, Math.ceil(total / query.page_size));
  return {
    corrective_actions,
    meta: {
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages,
    },
  };
}

async function getCorrectiveById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Corrective action not found');
  await assertCorrectiveAccess(requester, row.qa_review_id);
  const [full] = await hydrateCorrective([row]);
  return { corrective_action: full };
}

async function createCorrectiveAction(body, requester) {
  const qa = await repo.findQaReviewById(body.qa_review_id);
  if (!qa) throw new ApiError(400, 'Invalid qa_review_id');
  const scopeIds = await resolveScopedCohortIds(requester);
  if (!cohortIdInScope(scopeIds, qa.cohort_id)) throw new ApiError(403, 'Forbidden');
  await assertCorrectiveAccess(requester, body.qa_review_id);

  if (body.assigned_to) {
    const u = await cohortsRepo.findUser(body.assigned_to);
    if (!u) throw new ApiError(400, 'Invalid assigned_to');
  }

  const allowedOnCreate = new Set(['open', 'in_progress', 'overdue']);
  const status = body.status && allowedOnCreate.has(body.status) ? body.status : 'open';

  const created = await repo.create({
    qa_review_id: body.qa_review_id,
    assigned_to: body.assigned_to ?? null,
    action_text: body.action_text,
    due_date: parseDateOnly(body.due_date),
    status,
  });
  const [full] = await hydrateCorrective([created]);
  if (isOverdueAction(full)) {
    await dispatchAppEvent('corrective_action_overdue', { correctiveAction: full });
  }
  return { corrective_action: full };
}

async function updateCorrectiveAction(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Corrective action not found');
  await assertCorrectiveAccess(requester, row.qa_review_id);

  if (body.assigned_to) {
    const u = await cohortsRepo.findUser(body.assigned_to);
    if (!u) throw new ApiError(400, 'Invalid assigned_to');
  }

  const data = { updated_at: new Date() };
  if (body.action_text !== undefined) data.action_text = body.action_text;
  if (body.due_date !== undefined) data.due_date = parseDateOnly(body.due_date);
  if (body.assigned_to !== undefined) data.assigned_to = body.assigned_to;
  if (body.status !== undefined) {
    assertCorrectiveStatusTransition(row.status, body.status);
    data.status = body.status;
    if (['resolved', 'closed'].includes(body.status)) data.closed_at = new Date();
    else data.closed_at = null;
  }

  const updated = await repo.update(id, data);
  const [full] = await hydrateCorrective([updated]);
  if (isOverdueAction(full)) {
    await dispatchAppEvent('corrective_action_overdue', { correctiveAction: full });
  }
  return { corrective_action: full };
}

async function patchCorrectiveStatus(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Corrective action not found');
  await assertCorrectiveAccess(requester, row.qa_review_id);
  assertCorrectiveStatusTransition(row.status, body.status);
  const data = { status: body.status, updated_at: new Date() };
  if (['resolved', 'closed'].includes(body.status)) data.closed_at = new Date();
  else data.closed_at = null;
  const updated = await repo.update(id, data);
  const [full] = await hydrateCorrective([updated]);
  if (isOverdueAction(full)) {
    await dispatchAppEvent('corrective_action_overdue', { correctiveAction: full });
  }
  return { corrective_action: full };
}

module.exports = {
  listCorrectiveActions,
  getCorrectiveById,
  createCorrectiveAction,
  updateCorrectiveAction,
  patchCorrectiveStatus,
};
