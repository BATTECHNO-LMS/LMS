const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { canAccessCohort, normalizeRoles } = require('../../utils/deliveryAccess');
const sessionsRepository = require('./sessions.repository');
const cohortsRepository = require('../cohorts/cohorts.repository');
const enrollmentsRepository = require('../enrollments/enrollments.repository');
const attendanceRepository = require('../attendance/attendance.repository');
const { dateOnlyISO, parseDateOnly } = require('../cohorts/cohorts.service');

function parseTimeHm(str) {
  const s = String(str).trim();
  const iso = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!iso) throw new ApiError(400, 'Invalid time format, expected HH:mm or HH:mm:ss');
  const h = Number(iso[1]);
  const m = Number(iso[2]);
  const sec = iso[3] ? Number(iso[3]) : 0;
  if (h > 23 || m > 59 || sec > 59) throw new ApiError(400, 'Invalid time values');
  return new Date(Date.UTC(1970, 0, 1, h, m, sec));
}

function timeToHHMMSS(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(11, 19);
}

async function assertSessionCohortDate(sessionDate, cohort) {
  const cStart = dateOnlyISO(cohort.start_date);
  const cEnd = dateOnlyISO(cohort.end_date);
  const s = dateOnlyISO(sessionDate);
  if (s < cStart || s > cEnd) {
    throw new ApiError(400, 'session_date must fall within the cohort start and end dates');
  }
}

async function loadModuleBrief(moduleId) {
  if (!moduleId) return null;
  const m = await sessionsRepository.findModule(moduleId);
  if (!m) return null;
  return { id: m.id, title: m.title, sequence_no: m.sequence_no };
}

async function serializeSession(row) {
  const module = await loadModuleBrief(row.module_id);
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    title: row.title,
    session_date: dateOnlyISO(row.session_date),
    start_time: timeToHHMMSS(row.start_time),
    end_time: timeToHHMMSS(row.end_time),
    session_type: row.session_type,
    documentation_status: row.documentation_status,
    module_id: row.module_id,
    module,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function assertCohortForSessions(cohortId, requester) {
  const cohort = await cohortsRepository.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  return cohort;
}

async function listByCohort(cohortId, requester) {
  await assertCohortForSessions(cohortId, requester);
  const rows = await sessionsRepository.findManyByCohort(cohortId);
  const sessions = await Promise.all(rows.map((r) => serializeSession(r)));
  return { sessions };
}

/**
 * Sessions across cohorts the current student is enrolled in (student role only).
 * @param {import('../../middlewares/auth.middleware').RequestUser} requester
 */
async function listMine(requester) {
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes(String(env.STUDENT_ROLE_CODE || 'student').toLowerCase())) {
    throw new ApiError(403, 'Forbidden');
  }
  const cohortIds = await enrollmentsRepository.findCohortIdsForStudent(requester.userId);
  if (!cohortIds.length) return { sessions: [] };
  const rows = await sessionsRepository.findManyByCohortIds(cohortIds);
  const sessionIds = rows.map((r) => r.id);
  let recs = [];
  try {
    recs = await attendanceRepository.findRecordsForSessionsAndStudent(sessionIds, requester.userId);
  } catch {
    recs = [];
  }
  const recMap = new Map(recs.map((r) => [r.session_id, r.attendance_status]));
  const cohortCache = new Map();
  for (const cid of new Set(rows.map((r) => r.cohort_id))) {
    // eslint-disable-next-line no-await-in-loop
    cohortCache.set(cid, await cohortsRepository.findById(cid));
  }
  const mcCache = new Map();
  const sessions = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const base = await serializeSession(row);
    const cohort = cohortCache.get(row.cohort_id);
    let cohortPayload = null;
    if (cohort) {
      let mc = mcCache.get(cohort.micro_credential_id);
      if (mc === undefined) {
        // eslint-disable-next-line no-await-in-loop
        mc = await cohortsRepository.findMicroCredential(cohort.micro_credential_id);
        mcCache.set(cohort.micro_credential_id, mc);
      }
      cohortPayload = {
        id: cohort.id,
        title: cohort.title,
        status: cohort.status,
        micro_credential: mc ? { id: mc.id, title: mc.title, code: mc.code } : null,
      };
    }
    sessions.push({
      ...base,
      cohort: cohortPayload,
      my_attendance_status: recMap.get(row.id) ?? null,
    });
  }
  return { sessions };
}

async function createForCohort(cohortId, body, requester) {
  const cohort = await assertCohortForSessions(cohortId, requester);
  if (body.module_id) {
    const mod = await sessionsRepository.findModule(body.module_id);
    if (!mod) throw new ApiError(404, 'Module not found');
    if (mod.micro_credential_id !== cohort.micro_credential_id) {
      throw new ApiError(400, 'Module does not belong to the cohort micro-credential');
    }
  }

  const sessionDate = parseDateOnly(body.session_date);
  await assertSessionCohortDate(sessionDate, cohort);

  const startT = parseTimeHm(body.start_time);
  const endT = parseTimeHm(body.end_time);
  if (endT <= startT) throw new ApiError(400, 'end_time must be after start_time');

  const created = await sessionsRepository.create({
    cohort_id: cohortId,
    module_id: body.module_id ?? null,
    title: body.title,
    session_date: sessionDate,
    start_time: startT,
    end_time: endT,
    session_type: body.session_type ?? 'lecture',
    notes: body.notes ?? null,
    documentation_status: 'pending',
  });

  return serializeSession(created);
}

async function getById(id, requester) {
  const row = await sessionsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Session not found');
  await assertCohortForSessions(row.cohort_id, requester);
  return serializeSession(row);
}

async function update(id, body, requester) {
  const existing = await sessionsRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Session not found');
  const cohort = await assertCohortForSessions(existing.cohort_id, requester);

  const data = { updated_at: new Date() };
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.session_type !== undefined) data.session_type = body.session_type;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.module_id !== undefined) {
    if (body.module_id) {
      const mod = await sessionsRepository.findModule(body.module_id);
      if (!mod) throw new ApiError(404, 'Module not found');
      if (mod.micro_credential_id !== cohort.micro_credential_id) {
        throw new ApiError(400, 'Module does not belong to the cohort micro-credential');
      }
    }
    data.module_id = body.module_id;
  }

  let sessionDate = existing.session_date;
  if (body.session_date !== undefined) {
    sessionDate = parseDateOnly(body.session_date);
    await assertSessionCohortDate(sessionDate, cohort);
    data.session_date = sessionDate;
  }

  let startT = existing.start_time;
  let endT = existing.end_time;
  if (body.start_time !== undefined) startT = parseTimeHm(body.start_time);
  if (body.end_time !== undefined) endT = parseTimeHm(body.end_time);
  if (body.start_time !== undefined) data.start_time = startT;
  if (body.end_time !== undefined) data.end_time = endT;
  const endCompare = data.end_time ?? existing.end_time;
  const startCompare = data.start_time ?? existing.start_time;
  if (endCompare <= startCompare) throw new ApiError(400, 'end_time must be after start_time');

  const updated = await sessionsRepository.update(id, data);
  return serializeSession(updated);
}

async function patchDocumentation(id, body, requester) {
  const existing = await sessionsRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Session not found');
  await assertCohortForSessions(existing.cohort_id, requester);
  const updated = await sessionsRepository.update(id, {
    documentation_status: body.documentation_status,
    updated_at: new Date(),
  });
  return serializeSession(updated);
}

module.exports = {
  listByCohort,
  listMine,
  createForCohort,
  getById,
  update,
  patchDocumentation,
  assertCohortForSessions,
  findSessionByIdRaw: (id) => sessionsRepository.findById(id),
};
