const { ApiError } = require('../../utils/apiError');
const {
  normalizeRoles,
  assessmentCohortScopeWhere,
  canAccessCohort,
} = require('../../utils/deliveryAccess');
const { dispatchAppEvent } = require('../../shared/services/eventDispatcher.service');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const repo = require('./assessments.repository');

const STAFF_ROLES = new Set([
  'super_admin',
  'program_admin',
  'university_admin',
  'academic_admin',
  'qa_officer',
  'instructor',
]);

const STATUS_FLOW = {
  draft: new Set(['published', 'archived']),
  published: new Set(['open', 'draft', 'archived']),
  open: new Set(['closed', 'archived']),
  closed: new Set(['archived', 'open']),
  archived: new Set(),
};

function isStaffUser(requester) {
  if (requester.isGlobal) return true;
  const roles = normalizeRoles(requester.roles);
  return roles.some((r) => STAFF_ROLES.has(r));
}

function mapAssessment(row) {
  if (!row) return null;
  const cohort = row.cohorts;
  const mc = row.micro_credentials;
  const lo = row.learning_outcomes;
  const rub = row.rubrics;
  return {
    id: row.id,
    title: row.title,
    assessment_type: row.assessment_type,
    weight: row.weight != null ? Number(row.weight) : null,
    open_at: row.open_at,
    due_date: row.due_date,
    status: row.status,
    instructions: row.instructions,
    linked_outcome_id: row.linked_outcome_id,
    rubric_id: row.rubric_id,
    cohort_id: row.cohort_id,
    micro_credential_id: row.micro_credential_id,
    cohort: cohort
      ? { id: cohort.id, title: cohort.title, status: cohort.status }
      : null,
    micro_credential: mc ? { id: mc.id, title: mc.title, code: mc.code, status: mc.status } : null,
    linked_outcome: lo
      ? { id: lo.id, outcome_code: lo.outcome_code, outcome_text: lo.outcome_text }
      : null,
    rubric: rub ? { id: rub.id, title: rub.title, status: rub.status } : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listWhereForUser(requester, query) {
  const roles = normalizeRoles(requester.roles);
  const base = {};
  if (query.cohort_id) base.cohort_id = query.cohort_id;
  if (query.micro_credential_id) base.micro_credential_id = query.micro_credential_id;
  if (query.assessment_type) base.assessment_type = query.assessment_type;
  if (query.status) base.status = query.status;
  if (query.linked_outcome_id) base.linked_outcome_id = query.linked_outcome_id;
  if (query.search) {
    base.title = { contains: query.search, mode: 'insensitive' };
  }

  if (isStaffUser(requester)) {
    const scope = assessmentCohortScopeWhere(requester);
    return { AND: [scope, base] };
  }
  if (roles.includes('student')) {
    const cohortIds = await enrollmentsRepo.findCohortIdsForStudent(requester.userId);
    if (!cohortIds.length) return { id: { in: [] } };
    if (query.cohort_id && !cohortIds.includes(query.cohort_id)) return { id: { in: [] } };
    return { AND: [base, { cohort_id: { in: cohortIds } }] };
  }
  return { id: { in: [] } };
}

async function assertCanReadAssessment(requester, row) {
  if (!row) throw new ApiError(404, 'Assessment not found');
  const cohort = await repo.findCohortById(row.cohort_id);
  if (!cohort) throw new ApiError(404, 'Assessment not found');
  if (isStaffUser(requester)) {
    if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
    return;
  }
  const roles = normalizeRoles(requester.roles);
  if (roles.includes('student')) {
    const en = await enrollmentsRepo.findByCohortAndStudent(row.cohort_id, requester.userId);
    if (!en || !['pending', 'enrolled', 'completed'].includes(en.enrollment_status)) {
      throw new ApiError(403, 'Forbidden');
    }
    return;
  }
  throw new ApiError(403, 'Forbidden');
}

async function assertCanWriteAssessment(requester, row) {
  if (!row) throw new ApiError(404, 'Assessment not found');
  const cohort = await repo.findCohortById(row.cohort_id);
  if (!cohort) throw new ApiError(404, 'Assessment not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
}

async function listAssessments(query, requester) {
  const where = await listWhereForUser(requester, query);
  const [total, rows] = await Promise.all([
    repo.count(where),
    repo.findMany(where, { skip: query.skip, take: query.take }),
  ]);
  const total_pages = Math.max(1, Math.ceil(total / query.page_size));
  return {
    assessments: rows.map(mapAssessment),
    meta: {
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages,
    },
  };
}

async function getAssessmentById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Assessment not found');
  await assertCanReadAssessment(requester, row);
  const submissions_count = await repo.countSubmissions(id);
  const grades_count = await repo.countGrades(id);
  return {
    ...mapAssessment(row),
    submissions_count,
    grades_count,
  };
}

function parseDateTime(s) {
  const raw = String(s).trim();
  const iso = raw.length <= 10 ? `${raw}T12:00:00.000Z` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid datetime');
  return d;
}

async function validateAssessmentPayload(body, { cohortId, excludeAssessmentId } = {}) {
  const cohort = await repo.findCohortById(cohortId || body.cohort_id);
  if (!cohort) throw new ApiError(400, 'Invalid cohort_id');

  if (String(cohort.micro_credential_id) !== String(body.micro_credential_id)) {
    throw new ApiError(400, 'micro_credential_id must match the cohort micro-credential');
  }

  const w = Number(body.weight);
  if (!(w > 0) || w > 100) throw new ApiError(400, 'weight must be between 0 and 100 exclusive of 0');

  const currentSum = await repo.sumWeightsForCohort(cohort.id, excludeAssessmentId);
  if (currentSum + w > 100.0001) {
    throw new ApiError(400, `Total assessment weights for this cohort would exceed 100% (current other: ${currentSum}%)`);
  }

  if (body.linked_outcome_id) {
    const lo = await repo.findLearningOutcome(body.linked_outcome_id);
    if (!lo) throw new ApiError(400, 'Invalid linked_outcome_id');
    if (String(lo.micro_credential_id) !== String(body.micro_credential_id)) {
      throw new ApiError(400, 'linked_outcome_id must belong to the same micro-credential');
    }
  }

  if (body.rubric_id) {
    const rub = await repo.findRubric(body.rubric_id);
    if (!rub) throw new ApiError(400, 'Invalid rubric_id');
  }

  return { cohort };
}

async function createAssessment(body, requester) {
  if (!isStaffUser(requester)) throw new ApiError(403, 'Forbidden');
  await validateAssessmentPayload(body, {});
  const cohort = await repo.findCohortById(body.cohort_id);
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');

  const due = parseDateTime(body.due_date);
  const openAt = body.open_at != null && body.open_at !== '' ? parseDateTime(body.open_at) : null;

  const data = {
    cohort_id: body.cohort_id,
    micro_credential_id: body.micro_credential_id,
    title: body.title.trim(),
    assessment_type: body.assessment_type,
    weight: body.weight,
    due_date: due,
    open_at: openAt,
    linked_outcome_id: body.linked_outcome_id || null,
    rubric_id: body.rubric_id || null,
    instructions: body.instructions != null ? String(body.instructions) : null,
    status: body.status || 'draft',
  };

  const row = await repo.create(data);
  if (due < new Date()) {
    await dispatchAppEvent('assessment_overdue', { assessment: mapAssessment(row) });
  }
  return mapAssessment(row);
}

async function updateAssessment(id, body, requester) {
  if (!isStaffUser(requester)) throw new ApiError(403, 'Forbidden');
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Assessment not found');
  await assertCanWriteAssessment(requester, existing);

  const merged = {
    cohort_id: body.cohort_id ?? existing.cohort_id,
    micro_credential_id: body.micro_credential_id ?? existing.micro_credential_id,
    title: body.title !== undefined ? body.title.trim() : existing.title,
    assessment_type: body.assessment_type ?? existing.assessment_type,
    weight: body.weight !== undefined ? body.weight : Number(existing.weight),
    due_date: body.due_date !== undefined ? parseDateTime(body.due_date) : existing.due_date,
    open_at: body.open_at !== undefined ? (body.open_at ? parseDateTime(body.open_at) : null) : existing.open_at,
    linked_outcome_id: body.linked_outcome_id !== undefined ? body.linked_outcome_id || null : existing.linked_outcome_id,
    rubric_id: body.rubric_id !== undefined ? body.rubric_id || null : existing.rubric_id,
    instructions: body.instructions !== undefined ? body.instructions : existing.instructions,
    status: body.status !== undefined ? body.status : existing.status,
  };

  await validateAssessmentPayload(
    {
      cohort_id: merged.cohort_id,
      micro_credential_id: merged.micro_credential_id,
      weight: merged.weight,
      linked_outcome_id: merged.linked_outcome_id,
      rubric_id: merged.rubric_id,
    },
    { cohortId: merged.cohort_id, excludeAssessmentId: id }
  );

  const row = await repo.update(id, {
    cohort_id: merged.cohort_id,
    micro_credential_id: merged.micro_credential_id,
    title: merged.title,
    assessment_type: merged.assessment_type,
    weight: merged.weight,
    due_date: merged.due_date,
    open_at: merged.open_at,
    linked_outcome_id: merged.linked_outcome_id,
    rubric_id: merged.rubric_id,
    instructions: merged.instructions,
    status: merged.status,
  });
  if (new Date(merged.due_date) < new Date() && ['published', 'open'].includes(merged.status)) {
    await dispatchAppEvent('assessment_overdue', { assessment: mapAssessment(row) });
  }
  return mapAssessment(row);
}

async function patchAssessmentStatus(id, body, requester) {
  if (!isStaffUser(requester)) throw new ApiError(403, 'Forbidden');
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Assessment not found');
  await assertCanWriteAssessment(requester, existing);
  const next = body.status;
  const cur = existing.status;
  const allowed = STATUS_FLOW[cur];
  if (!allowed || !allowed.has(next)) {
    throw new ApiError(400, `Invalid status transition from ${cur} to ${next}`);
  }
  const row = await repo.update(id, { status: next });
  if (next === 'closed') {
    const submissionsCount = await repo.countSubmissions(id);
    const gradesCount = await repo.countGrades(id);
    if (submissionsCount > gradesCount) {
      await dispatchAppEvent('assessment_ungraded_before_closure', { assessment: mapAssessment(row) });
    }
  }
  return mapAssessment(row);
}

module.exports = {
  listAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  patchAssessmentStatus,
  assertCanReadAssessment,
  assertCanWriteAssessment,
  mapAssessment,
  isStaffUser,
};
