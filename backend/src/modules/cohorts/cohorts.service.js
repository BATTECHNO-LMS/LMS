const { ApiError } = require('../../utils/apiError');
const { canAccessCohort, cohortListWhere } = require('../../utils/deliveryAccess');
const cohortsRepository = require('./cohorts.repository');

function parseDateOnly(s) {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid date');
  return d;
}

function dateOnlyISO(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

async function loadUserBrief(id) {
  if (!id) return null;
  const u = await cohortsRepository.findUser(id);
  if (!u) return null;
  return { id: u.id, full_name: u.full_name, email: u.email };
}

async function loadMicroBrief(id) {
  const mc = await cohortsRepository.findMicroCredential(id);
  if (!mc) return null;
  return { id: mc.id, title: mc.title, code: mc.code, status: mc.status };
}

async function loadUniversityBrief(id) {
  const uni = await cohortsRepository.findUniversity(id);
  if (!uni) return null;
  return { id: uni.id, name: uni.name, status: uni.status };
}

function buildListWhere(query, scopeWhere) {
  const parts = [];
  if (scopeWhere && Object.keys(scopeWhere).length) parts.push(scopeWhere);
  if (query.status) parts.push({ status: query.status });
  if (query.university_id) parts.push({ university_id: query.university_id });
  if (query.micro_credential_id) parts.push({ micro_credential_id: query.micro_credential_id });
  if (query.instructor_id) parts.push({ instructor_id: query.instructor_id });
  if (query.search) {
    parts.push({
      title: { contains: query.search, mode: 'insensitive' },
    });
  }
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

async function assertMicroLinkedToUniversity(microCredentialId, universityId) {
  const link = await cohortsRepository.findMicroCredentialUniversityLink(microCredentialId, universityId);
  if (!link) {
    throw new ApiError(400, 'Micro-credential is not linked to the selected university');
  }
}

async function validateStatusTransition(current, next, cohortRow) {
  if (current === next) return;
  const mc = await cohortsRepository.findMicroCredential(cohortRow.micro_credential_id);
  if (!mc) throw new ApiError(400, 'Micro-credential not found');

  if (next === 'open_for_enrollment' && mc.status !== 'active') {
    throw new ApiError(400, 'Cohort cannot open for enrollment until the micro-credential is active');
  }

  if (next === 'active') {
    if (!cohortRow.instructor_id) {
      throw new ApiError(400, 'Assign an instructor before activating the cohort');
    }
    if (!cohortRow.start_date || !cohortRow.end_date) {
      throw new ApiError(400, 'Start and end dates are required to activate the cohort');
    }
  }

  if (next === 'completed') {
    if (!cohortRow.id) {
      throw new ApiError(400, 'Cannot complete a cohort without a persisted id');
    }
    const sessionCount = await cohortsRepository.countSessions(cohortRow.id);
    if (sessionCount === 0) {
      throw new ApiError(400, 'Add at least one session before marking the cohort as completed');
    }
    const docs = await cohortsRepository.findSessionsDocumentation(cohortRow.id);
    const pending = docs.filter((s) => s.documentation_status !== 'documented');
    if (pending.length) {
      throw new ApiError(400, 'All sessions must be documented before completing the cohort');
    }
  }

  if (next === 'closed' && current !== 'completed') {
    throw new ApiError(400, 'Cohort can only be closed after it is completed');
  }
}

async function serializeCohortListRow(row) {
  const [micro_credential, university, instructor] = await Promise.all([
    loadMicroBrief(row.micro_credential_id),
    loadUniversityBrief(row.university_id),
    loadUserBrief(row.instructor_id),
  ]);
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    start_date: dateOnlyISO(row.start_date),
    end_date: dateOnlyISO(row.end_date),
    capacity: row.capacity,
    micro_credential,
    university,
    instructor,
  };
}

async function serializeCohortDetail(row) {
  const base = await serializeCohortListRow(row);
  const [enrollments_count, sessions_count, sessions_doc] = await Promise.all([
    cohortsRepository.countEnrollments(row.id),
    cohortsRepository.countSessions(row.id),
    cohortsRepository.findSessionsDocumentation(row.id),
  ]);
  const documented = sessions_doc.filter((s) => s.documentation_status === 'documented').length;
  return {
    ...base,
    enrollments_count,
    sessions_count,
    attendance_summary_hint: {
      sessions_total: sessions_count,
      sessions_documented: documented,
    },
  };
}

async function listCohorts(query, requester) {
  const scope = cohortListWhere(requester);
  const where = buildListWhere(query, scope || undefined);
  const rows = await cohortsRepository.findMany(where, { take: 500 });
  const cohorts = await Promise.all(rows.map((r) => serializeCohortListRow(r)));
  return { cohorts };
}

async function getCohortById(id, requester) {
  const row = await cohortsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, row)) throw new ApiError(403, 'Forbidden');
  return serializeCohortDetail(row);
}

async function createCohort(body, requester) {
  const mc = await cohortsRepository.findMicroCredential(body.micro_credential_id);
  if (!mc) throw new ApiError(404, 'Micro-credential not found');
  const uni = await cohortsRepository.findUniversity(body.university_id);
  if (!uni) throw new ApiError(404, 'University not found');
  await assertMicroLinkedToUniversity(body.micro_credential_id, body.university_id);

  if (body.instructor_id) {
    const ins = await cohortsRepository.findUser(body.instructor_id);
    if (!ins) throw new ApiError(400, 'Instructor user not found');
  }

  const start = parseDateOnly(body.start_date);
  const end = parseDateOnly(body.end_date);
  if (end < start) throw new ApiError(400, 'end_date must be on or after start_date');

  const status = body.status ?? 'planned';
  if (!['planned', 'open_for_enrollment'].includes(status)) {
    throw new ApiError(400, 'Initial cohort status may only be planned or open_for_enrollment');
  }
  if (status === 'open_for_enrollment') {
    await validateStatusTransition('planned', 'open_for_enrollment', {
      id: null,
      micro_credential_id: body.micro_credential_id,
      university_id: body.university_id,
      instructor_id: body.instructor_id ?? null,
      title: body.title,
      start_date: start,
      end_date: end,
      capacity: body.capacity,
    });
  }

  const created = await cohortsRepository.create({
    micro_credential_id: body.micro_credential_id,
    university_id: body.university_id,
    instructor_id: body.instructor_id ?? null,
    title: body.title,
    start_date: start,
    end_date: end,
    capacity: body.capacity,
    status,
  });

  return serializeCohortDetail(created);
}

async function updateCohort(id, body, requester) {
  const existing = await cohortsRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, existing)) throw new ApiError(403, 'Forbidden');

  const nextMcId = body.micro_credential_id ?? existing.micro_credential_id;
  const nextUniId = body.university_id ?? existing.university_id;
  if (body.micro_credential_id != null || body.university_id != null) {
    await assertMicroLinkedToUniversity(nextMcId, nextUniId);
  }

  if (body.instructor_id !== undefined && body.instructor_id) {
    const ins = await cohortsRepository.findUser(body.instructor_id);
    if (!ins) throw new ApiError(400, 'Instructor user not found');
  }

  const data = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.micro_credential_id !== undefined) data.micro_credential_id = body.micro_credential_id;
  if (body.university_id !== undefined) data.university_id = body.university_id;
  if (body.instructor_id !== undefined) data.instructor_id = body.instructor_id;
  if (body.capacity !== undefined) data.capacity = body.capacity;

  let start = existing.start_date;
  let end = existing.end_date;
  if (body.start_date !== undefined) start = parseDateOnly(body.start_date);
  if (body.end_date !== undefined) end = parseDateOnly(body.end_date);
  if (end < start) throw new ApiError(400, 'end_date must be on or after start_date');
  if (body.start_date !== undefined) data.start_date = start;
  if (body.end_date !== undefined) data.end_date = end;

  if (body.status !== undefined && body.status !== existing.status) {
    const merged = {
      ...existing,
      ...data,
      start_date: data.start_date ?? existing.start_date,
      end_date: data.end_date ?? existing.end_date,
      instructor_id: data.instructor_id !== undefined ? data.instructor_id : existing.instructor_id,
      micro_credential_id: data.micro_credential_id ?? existing.micro_credential_id,
    };
    await validateStatusTransition(existing.status, body.status, merged);
    data.status = body.status;
  }

  data.updated_at = new Date();
  const updated = await cohortsRepository.update(id, data);
  return serializeCohortDetail(updated);
}

async function patchCohortStatus(id, body, requester) {
  const existing = await cohortsRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, existing)) throw new ApiError(403, 'Forbidden');
  if (body.status === existing.status) {
    return serializeCohortDetail(existing);
  }
  await validateStatusTransition(existing.status, body.status, existing);
  const updated = await cohortsRepository.update(id, { status: body.status, updated_at: new Date() });
  return serializeCohortDetail(updated);
}

module.exports = {
  listCohorts,
  getCohortById,
  createCohort,
  updateCohort,
  patchCohortStatus,
  dateOnlyISO,
  parseDateOnly,
};
