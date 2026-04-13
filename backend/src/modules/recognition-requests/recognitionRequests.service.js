const { ApiError } = require('../../utils/apiError');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const cohortsRepo = require('../cohorts/cohorts.repository');
const { prisma } = require('../../config/db');
const repo = require('./recognitionRequests.repository');

const STATUS_FLOW = {
  draft: new Set(['in_preparation']),
  in_preparation: new Set(['draft', 'ready_for_submission']),
  ready_for_submission: new Set(['in_preparation', 'submitted']),
  submitted: new Set(['under_review', 'needs_revision']),
  under_review: new Set(['approved', 'rejected', 'needs_revision']),
  approved: new Set(),
  rejected: new Set(),
  needs_revision: new Set(['in_preparation', 'ready_for_submission']),
};

function assertStatusTransition(from, to) {
  const allowed = STATUS_FLOW[from];
  if (!allowed || !allowed.has(to)) {
    throw new ApiError(400, `Invalid recognition request status transition: ${from} -> ${to}`);
  }
}

function listScopeWhere(requester) {
  if (requester.isGlobal) {
    const roles = normalizeRoles(requester.roles);
    if (roles.includes('super_admin')) return {};
  }
  const roles = normalizeRoles(requester.roles);
  const uni = requester.universityId;
  if (uni && roles.some((r) => ['university_admin', 'university_reviewer', 'academic_admin'].includes(r))) {
    return { university_id: uni };
  }
  if (roles.includes('program_admin')) return {};
  return { id: { in: [] } };
}

function assertCanAccessRow(requester, row) {
  if (!row) throw new ApiError(404, 'Recognition request not found');
  const scope = listScopeWhere(requester);
  if (scope.id && Array.isArray(scope.id.in) && scope.id.in.length === 0) throw new ApiError(403, 'Forbidden');
  if (scope.university_id && row.university_id !== scope.university_id) throw new ApiError(403, 'Forbidden');
}

async function buildListWhere(query, requester) {
  const scope = listScopeWhere(requester);
  const and = [];
  if (scope.id) return scope;
  if (Object.keys(scope).length) and.push(scope);
  if (query.university_id) and.push({ university_id: query.university_id });
  if (query.micro_credential_id) and.push({ micro_credential_id: query.micro_credential_id });
  if (query.cohort_id) and.push({ cohort_id: query.cohort_id });
  if (query.status) and.push({ status: query.status });
  if (query.search) {
    and.push({
      OR: [{ decision_notes: { contains: query.search, mode: 'insensitive' } }],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateRequests(rows) {
  if (!rows.length) return [];
  const uniIds = [...new Set(rows.map((r) => r.university_id))];
  const mcIds = [...new Set(rows.map((r) => r.micro_credential_id))];
  const coIds = [...new Set(rows.map((r) => r.cohort_id))];
  const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
  const [unis, mcs, cohorts, users] = await Promise.all([
    prisma.universities.findMany({ where: { id: { in: uniIds } } }),
    prisma.micro_credentials.findMany({ where: { id: { in: mcIds } } }),
    prisma.cohorts.findMany({ where: { id: { in: coIds } } }),
    userIds.length
      ? prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } })
      : [],
  ]);
  const uMap = new Map(unis.map((x) => [x.id, x]));
  const mcMap = new Map(mcs.map((x) => [x.id, x]));
  const cMap = new Map(cohorts.map((x) => [x.id, x]));
  const usrMap = new Map(users.map((x) => [x.id, x]));
  return rows.map((r) => ({
    id: r.id,
    university_id: r.university_id,
    micro_credential_id: r.micro_credential_id,
    cohort_id: r.cohort_id,
    created_by: r.created_by,
    status: r.status,
    submitted_at: r.submitted_at,
    reviewed_at: r.reviewed_at,
    decision_notes: r.decision_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    university: uMap.get(r.university_id) ? { id: r.university_id, name: uMap.get(r.university_id).name } : null,
    micro_credential: mcMap.get(r.micro_credential_id)
      ? { id: r.micro_credential_id, title: mcMap.get(r.micro_credential_id).title, code: mcMap.get(r.micro_credential_id).code }
      : null,
    cohort: cMap.get(r.cohort_id) ? { id: r.cohort_id, title: cMap.get(r.cohort_id).title, status: cMap.get(r.cohort_id).status } : null,
    created_by_user: r.created_by ? usrMap.get(r.created_by) ?? null : null,
  }));
}

async function mapDocuments(docs) {
  return docs.map((d) => ({
    id: d.id,
    recognition_request_id: d.recognition_request_id,
    document_type: d.document_type,
    title: d.title,
    file_url: d.file_url,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

async function assertRecognitionLinks(body) {
  const uni = await prisma.universities.findUnique({ where: { id: body.university_id } });
  if (!uni) throw new ApiError(400, 'Invalid university_id');
  const mc = await prisma.micro_credentials.findUnique({ where: { id: body.micro_credential_id } });
  if (!mc) throw new ApiError(400, 'Invalid micro_credential_id');
  const cohort = await cohortsRepo.findById(body.cohort_id);
  if (!cohort) throw new ApiError(400, 'Invalid cohort_id');
  if (cohort.university_id !== body.university_id) throw new ApiError(400, 'cohort_id must belong to the same university');
  if (cohort.micro_credential_id !== body.micro_credential_id) {
    throw new ApiError(400, 'micro_credential_id must match the cohort micro-credential');
  }
}

async function assertMeetsReadyForSubmission(requestId) {
  const count = await repo.countDocuments(requestId);
  if (count < 1) throw new ApiError(400, 'At least one recognition document is required');
  const hasCred = await repo.hasDocumentType(requestId, 'credential_description');
  const hasAlign = await repo.hasDocumentType(requestId, 'alignment_matrix');
  if (!hasCred || !hasAlign) {
    throw new ApiError(400, 'credential_description and alignment_matrix documents are required before ready_for_submission');
  }
}

async function listRecognitionRequests(query, requester) {
  const where = await buildListWhere(query, requester);
  const rows = await repo.findMany(where, { take: 200 });
  const recognition_requests = await hydrateRequests(rows);
  return { recognition_requests };
}

async function getRecognitionRequestById(id, requester) {
  const row = await repo.findById(id);
  assertCanAccessRow(requester, row);
  const [full] = await hydrateRequests([row]);
  const docs = await prisma.recognition_documents.findMany({
    where: { recognition_request_id: id },
    orderBy: { created_at: 'asc' },
  });
  const recognition_documents = await mapDocuments(docs);
  const readiness = {
    document_count: docs.length,
    has_credential_description: await repo.hasDocumentType(id, 'credential_description'),
    has_alignment_matrix: await repo.hasDocumentType(id, 'alignment_matrix'),
  };
  return { recognition_request: full, recognition_documents, readiness };
}

async function createRecognitionRequest(body, requester) {
  await assertRecognitionLinks(body);
  const scope = listScopeWhere(requester);
  if (scope.university_id && body.university_id !== scope.university_id) throw new ApiError(403, 'Forbidden');
  const roles = normalizeRoles(requester.roles);
  if (!roles.some((r) => ['super_admin', 'program_admin', 'university_admin', 'academic_admin'].includes(r))) {
    throw new ApiError(403, 'Forbidden');
  }
  const allowedCreate = new Set(['draft', 'in_preparation']);
  const status = body.status && allowedCreate.has(body.status) ? body.status : 'draft';
  const created = await repo.create({
    university_id: body.university_id,
    micro_credential_id: body.micro_credential_id,
    cohort_id: body.cohort_id,
    created_by: body.created_by ?? requester.userId,
    status,
    decision_notes: body.decision_notes ?? null,
  });
  const [full] = await hydrateRequests([created]);
  return { recognition_request: full };
}

async function updateRecognitionRequest(id, body, requester) {
  const row = await repo.findById(id);
  assertCanAccessRow(requester, row);
  const roles = normalizeRoles(requester.roles);
  if (!roles.some((r) => ['super_admin', 'program_admin', 'university_admin', 'academic_admin'].includes(r))) {
    throw new ApiError(403, 'Forbidden');
  }
  const data = { updated_at: new Date() };
  if (body.decision_notes !== undefined) data.decision_notes = body.decision_notes;
  const updated = await repo.update(id, data);
  const [full] = await hydrateRequests([updated]);
  return { recognition_request: full };
}

async function patchRecognitionStatus(id, body, requester) {
  const row = await repo.findById(id);
  assertCanAccessRow(requester, row);
  const roles = normalizeRoles(requester.roles);
  if (!roles.some((r) => ['super_admin', 'program_admin', 'university_admin', 'academic_admin', 'university_reviewer'].includes(r))) {
    throw new ApiError(403, 'Forbidden');
  }
  assertStatusTransition(row.status, body.status);
  if (body.status === 'ready_for_submission') await assertMeetsReadyForSubmission(id);
  if (body.status === 'submitted' && row.status !== 'ready_for_submission') {
    throw new ApiError(400, 'May only submit from ready_for_submission');
  }
  const data = { status: body.status, updated_at: new Date() };
  if (body.status === 'submitted') data.submitted_at = new Date();
  if (['approved', 'rejected'].includes(body.status)) data.reviewed_at = new Date();
  const updated = await repo.update(id, data);
  const [full] = await hydrateRequests([updated]);
  return { recognition_request: full };
}

module.exports = {
  listRecognitionRequests,
  getRecognitionRequestById,
  createRecognitionRequest,
  updateRecognitionRequest,
  patchRecognitionStatus,
};
