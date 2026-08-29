const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const { prisma } = require('../../config/db');
const { resolvePrimaryUniversityId } = require('../../utils/studentScope');
const cohortsService = require('../cohorts/cohorts.service');
const enrollmentsRepository = require('../enrollments/enrollments.repository');
const { dateOnlyISO } = require('../../utils/dateOnly');
const { STEP_ORDER, resolveStepIndex } = require('../fieldTraining/fieldTraining.progress');
const ftRepo = require('../fieldTraining/fieldTraining.repository');
const taskProgress = require('../fieldTraining/fieldTraining.taskProgress');

function timeToHHMMSS(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(11, 19);
}

function parseTimeToMinutes(value) {
  if (value == null || value === '') return null;
  const parts = String(value).trim().split(':').map((p) => Number(p));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
}

function sessionDurationHours(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null || end <= start) return 0;
  return Math.round(((end - start) / 60) * 100) / 100;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function progressPercent(trainingStatus, applicationStatus) {
  if (String(trainingStatus) === 'completed') return 100;
  const idx = resolveStepIndex(trainingStatus, applicationStatus);
  const max = Math.max(1, STEP_ORDER.length - 1);
  return Math.min(100, Math.round((idx / max) * 100));
}

function displayPhase(app, opp) {
  const ts = String(app.training_status || '');
  if (ts === 'completed') {
    return { key: 'completed', message_key: 'completed' };
  }
  if (
    [
      'in_training',
      'task_pending',
      'task_submitted',
      'post_assessment_pending',
      'post_assessment_completed',
      'eligible_for_completion',
    ].includes(ts)
  ) {
    return { key: 'in_training', message_key: 'in_training' };
  }
  return {
    key: 'not_started',
    message_key: 'not_started',
    starts_on: dateOnlyISO(opp.start_date) || null,
  };
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

async function buildCourseSchedule(requester, primaryUni) {
  const rows = await enrollmentsRepository.findManyByStudent(requester.userId);
  const active = rows.filter((e) => ['enrolled', 'completed'].includes(e.enrollment_status));
  const cohortIds = active.map((e) => e.cohort_id);
  if (!cohortIds.length) return [];

  const cohortRows = await prisma.cohorts.findMany({
    where: {
      id: { in: cohortIds },
      university_id: primaryUni,
    },
  });
  const scopedIds = cohortRows.map((c) => c.id);
  if (!scopedIds.length) return [];

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
  return schedule;
}

/**
 * Visible field-training applications for the current student.
 * Includes pending + approved; excludes rejected / cancelled / expelled / failed.
 */
async function buildFieldTrainings(studentId) {
  const apps = await prisma.field_training_applications.findMany({
    where: {
      student_id: studentId,
      status: { in: ['pending', 'approved'] },
      training_status: { notIn: ['expelled', 'failed'] },
    },
    orderBy: { created_at: 'desc' },
    include: {
      field_training_opportunities: {
        include: {
          specialties: {
            select: { id: true, name_ar: true, name_en: true, code: true, status: true },
          },
        },
      },
    },
  });

  if (!apps.length) return [];

  const oppIds = [...new Set(apps.map((a) => a.opportunity_id))];
  const instructorIds = [
    ...new Set(
      apps
        .map((a) => a.field_training_opportunities?.assigned_instructor_id)
        .filter(Boolean)
    ),
  ];

  const [sessions, instructors, progressByApp] = await Promise.all([
    prisma.field_training_sessions.findMany({
      where: { opportunity_id: { in: oppIds } },
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
    }),
    instructorIds.length
      ? prisma.users.findMany({
          where: { id: { in: instructorIds } },
          select: { id: true, full_name: true },
        })
      : Promise.resolve([]),
    taskProgress.calculateTaskProgressForApplications(
      apps.map((a) => ({
        id: a.id,
        opportunity_id: a.opportunity_id,
        student_id: a.student_id,
        status: a.status,
        opportunity_status: a.field_training_opportunities?.status,
      })),
      {
        opportunitiesById: new Map(
          apps
            .filter((a) => a.field_training_opportunities)
            .map((a) => [a.opportunity_id, a.field_training_opportunities])
        ),
      }
    ),
  ]);

  const instructorMap = new Map(instructors.map((u) => [u.id, u]));
  const sessionsByOpp = new Map();
  for (const s of sessions) {
    const list = sessionsByOpp.get(s.opportunity_id) || [];
    list.push(s);
    sessionsByOpp.set(s.opportunity_id, list);
  }

  const today = todayDateOnly();
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();

  return apps.map((app) => {
    const opp = app.field_training_opportunities;
    const oppSessions = sessionsByOpp.get(app.opportunity_id) || [];

    let totalHours = 0;
    let completedHours = 0;
    for (const s of oppSessions) {
      const hours = sessionDurationHours(s.start_time, s.end_time);
      totalHours += hours;
      const date = dateOnlyISO(s.session_date);
      if (!date) continue;
      if (date < today) completedHours += hours;
      else if (date === today) {
        const endMin = parseTimeToMinutes(s.end_time);
        if (endMin != null && endMin <= nowMinutes) completedHours += hours;
      }
    }
    totalHours = Math.round(totalHours * 100) / 100;
    completedHours = Math.round(completedHours * 100) / 100;

    const upcoming = oppSessions.find((s) => {
      const date = dateOnlyISO(s.session_date);
      if (!date) return false;
      if (date > today) return true;
      if (date < today) return false;
      const endMin = parseTimeToMinutes(s.end_time);
      return endMin == null || endMin > nowMinutes;
    });

    const instructorId = opp?.assigned_instructor_id || null;
    const instructorUser = instructorId ? instructorMap.get(instructorId) : null;
    const phase = displayPhase(app, opp || {});

    // Prefer authoritative Model A hours when recorded; otherwise session-calendar estimate for schedule UX.
    const requiredHours =
      opp?.required_training_hours != null ? Number(opp.required_training_hours) : null;
    const storedCompleted =
      app.completed_training_hours != null ? Number(app.completed_training_hours) : null;
    const authoritativeCompleted = storedCompleted != null ? storedCompleted : completedHours;
    const authoritativeTotal = requiredHours != null ? requiredHours : totalHours;
    const authoritativeRemaining = Math.max(
      0,
      Math.round((authoritativeTotal - authoritativeCompleted) * 100) / 100
    );

    return {
      application_id: app.id,
      opportunity_id: app.opportunity_id,
      title: opp?.title || null,
      organization_name: opp?.organization_name || null,
      specialty: ftRepo.mapSpecialtySummary(opp?.specialties),
      instructor: instructorUser
        ? { id: instructorUser.id, full_name: instructorUser.full_name }
        : null,
      training_mode: opp?.training_mode || null,
      location: opp?.location || null,
      start_date: dateOnlyISO(opp?.start_date),
      end_date: dateOnlyISO(opp?.end_date),
      required_training_hours: requiredHours,
      total_training_hours: authoritativeTotal,
      completed_training_hours: authoritativeCompleted,
      remaining_training_hours: authoritativeRemaining,
      hours_source: storedCompleted != null ? 'recorded' : 'session_estimate',
      application_status: app.status,
      training_status: app.training_status,
      task_progress: progressByApp.get(app.id) || null,
      attendance_percentage:
        app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      progress_percent: progressPercent(app.training_status, app.status),
      display_phase: phase,
      upcoming_session: upcoming
        ? {
            id: upcoming.id,
            title: upcoming.title,
            session_date: dateOnlyISO(upcoming.session_date),
            start_time: upcoming.start_time,
            end_time: upcoming.end_time,
            zoom_link: upcoming.zoom_link || null,
          }
        : null,
    };
  });
}

/**
 * Sessions for enrollments in **enrolled** or **completed** state, plus the student's active field trainings.
 */
async function semesterSchedule(requester) {
  await assertStudent(requester);
  const primaryUni = await resolvePrimaryUniversityId(requester);
  if (!primaryUni) throw new ApiError(400, 'Primary university is required for your account');

  const [schedule, fieldTrainings] = await Promise.all([
    buildCourseSchedule(requester, primaryUni),
    buildFieldTrainings(requester.userId),
  ]);

  return {
    schedule,
    field_trainings: fieldTrainings,
  };
}

module.exports = {
  availableCohorts,
  semesterSchedule,
};
