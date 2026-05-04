const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const { prisma } = require('../../config/db');
const { resolvePrimaryUniversityId } = require('../../utils/studentScope');
const cohortsService = require('../cohorts/cohorts.service');
const enrollmentsRepository = require('../enrollments/enrollments.repository');
const { dateOnlyISO } = require('../cohorts/cohorts.service');

function timeToHHMMSS(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(11, 19);
}

async function assertStudent(requester) {
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes(String(env.STUDENT_ROLE_CODE || 'student').toLowerCase())) {
    throw new ApiError(403, 'Forbidden');
  }
}

async function availableCohorts(requester) {
  await assertStudent(requester);
  const uid = await resolvePrimaryUniversityId(requester);
  if (!uid) throw new ApiError(400, 'Primary university is required for your account');
  return cohortsService.listAvailableForUniversity(uid);
}

/**
 * Sessions for enrollments in **enrolled** or **completed** state, scoped to the student's primary university.
 */
async function semesterSchedule(requester) {
  await assertStudent(requester);
  const primaryUni = await resolvePrimaryUniversityId(requester);
  if (!primaryUni) throw new ApiError(400, 'Primary university is required for your account');

  const rows = await enrollmentsRepository.findManyByStudent(requester.userId);
  const active = rows.filter((e) => ['enrolled', 'completed'].includes(e.enrollment_status));
  const cohortIds = active.map((e) => e.cohort_id);
  if (!cohortIds.length) return { schedule: [] };

  const cohortRows = await prisma.cohorts.findMany({
    where: {
      id: { in: cohortIds },
      university_id: primaryUni,
    },
  });
  const scopedIds = cohortRows.map((c) => c.id);
  if (!scopedIds.length) return { schedule: [] };

  const sessions = await prisma.sessions.findMany({
    where: { cohort_id: { in: scopedIds } },
    orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
  });

  const cohortMap = new Map(cohortRows.map((c) => [c.id, c]));
  const mcIds = [...new Set(cohortRows.map((c) => c.micro_credential_id))];
  const mcs = mcIds.length ? await prisma.micro_credentials.findMany({ where: { id: { in: mcIds } } }) : [];
  const mcMap = new Map(mcs.map((m) => [m.id, m]));
  const trackIds = [...new Set(mcs.map((m) => m.track_id).filter(Boolean))];
  const tracks = trackIds.length ? await prisma.tracks.findMany({ where: { id: { in: trackIds } } }) : [];
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  const schedule = [];
  for (const s of sessions) {
    const cohort = cohortMap.get(s.cohort_id);
    if (!cohort) continue;
    const mc = mcMap.get(cohort.micro_credential_id);
    const tr = mc?.track_id ? trackMap.get(mc.track_id) : null;
    schedule.push({
      session_id: s.id,
      cohort_id: s.cohort_id,
      cohort_title: cohort.title,
      track: tr ? { id: tr.id, title: tr.title } : null,
      micro_credential: mc ? { id: mc.id, title: mc.title } : null,
      session_title: s.title,
      session_date: dateOnlyISO(s.session_date),
      start_time: timeToHHMMSS(s.start_time),
      end_time: timeToHHMMSS(s.end_time),
      session_type: s.session_type,
      documentation_status: s.documentation_status,
    });
  }
  return { schedule };
}

module.exports = {
  availableCohorts,
  semesterSchedule,
};
