'use strict';

/**
 * Admin/instructor per-lecture student progress roster.
 * Population = eligible approved (non-expelled, active) applications for the opportunity,
 * LEFT JOIN progress + optional linked-session attendance.
 */

const { ApiError } = require('../../utils/apiError');
const { formatDateOnly } = require('../../utils/dateOnly');
const ftRepo = require('./fieldTraining.repository');
const lectureRepo = require('./fieldTraining.recordedLectures.repository');
const access = require('./fieldTraining.access');
const {
  mapStudentProgress,
  emptyStudentProgress,
  WATCH_STATUSES,
} = require('./fieldTraining.recordedLectures.watch.service');
const { MSG } = require('./fieldTraining.recordedLectures.constants');
const { prisma } = require('../../config/db');

const SORT_ALLOWLIST = new Set([
  'progress_desc',
  'progress_asc',
  'name_asc',
  'name_desc',
  'completed_at_desc',
  'completed_at_asc',
  'last_activity_desc',
  'last_activity_asc',
]);

const FILTER_ALLOWLIST = new Set([
  'all',
  'completed',
  'in_progress',
  'not_started',
  'present',
  'not_present',
  'needs_sync',
]);

function normalizePage(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function normalizePageSize(value, fallback = 25) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 100);
}

function attendanceLabel(status) {
  if (status == null) return null;
  return String(status).toLowerCase();
}

function matchesSearch(row, q) {
  if (!q) return true;
  const hay = `${row.name || ''} ${row.studentNumber || ''}`.toLowerCase();
  return hay.includes(q);
}

function matchesFilter(row, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'completed') return row.completionStatus === WATCH_STATUSES.COMPLETED;
  if (filter === 'in_progress') return row.completionStatus === WATCH_STATUSES.IN_PROGRESS;
  if (filter === 'not_started') return row.completionStatus === WATCH_STATUSES.NOT_STARTED;
  if (filter === 'present') return row.attendanceStatus === 'present';
  if (filter === 'not_present') {
    return row.attendanceStatus == null || row.attendanceStatus !== 'present';
  }
  if (filter === 'needs_sync') return Boolean(row.needsSync);
  return true;
}

function compareRows(a, b, sort) {
  const nameA = String(a.name || '');
  const nameB = String(b.name || '');
  switch (sort) {
    case 'progress_asc':
      return a.progressPercent - b.progressPercent || nameA.localeCompare(nameB, 'ar');
    case 'name_asc':
      return nameA.localeCompare(nameB, 'ar');
    case 'name_desc':
      return nameB.localeCompare(nameA, 'ar');
    case 'completed_at_asc': {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb || nameA.localeCompare(nameB, 'ar');
    }
    case 'completed_at_desc': {
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return tb - ta || nameA.localeCompare(nameB, 'ar');
    }
    case 'last_activity_asc': {
      const ta = a.lastProgressAt ? new Date(a.lastProgressAt).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.lastProgressAt ? new Date(b.lastProgressAt).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb || nameA.localeCompare(nameB, 'ar');
    }
    case 'last_activity_desc': {
      const ta = a.lastProgressAt ? new Date(a.lastProgressAt).getTime() : 0;
      const tb = b.lastProgressAt ? new Date(b.lastProgressAt).getTime() : 0;
      return tb - ta || nameA.localeCompare(nameB, 'ar');
    }
    case 'progress_desc':
    default:
      return b.progressPercent - a.progressPercent || nameA.localeCompare(nameB, 'ar');
  }
}

function buildSummary(rows, hasLinkedSession) {
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let progressSum = 0;
  let linkedSessionPresent = 0;
  let needsSync = 0;

  for (const row of rows) {
    progressSum += Number(row.progressPercent) || 0;
    if (row.completionStatus === WATCH_STATUSES.COMPLETED) completed += 1;
    else if (row.completionStatus === WATCH_STATUSES.IN_PROGRESS) inProgress += 1;
    else notStarted += 1;
    if (row.attendanceStatus === 'present') linkedSessionPresent += 1;
    if (row.needsSync) needsSync += 1;
  }

  const total = rows.length;
  return {
    totalStudents: total,
    completed,
    inProgress,
    notStarted,
    averageProgress: total ? Math.round((progressSum / total) * 10) / 10 : 0,
    linkedSessionPresent: hasLinkedSession ? linkedSessionPresent : null,
    needsSync,
  };
}

async function listLectureStudentProgress(lectureId, user, query = {}) {
  const row = await lectureRepo.findById(lectureId);
  if (!row) throw new ApiError(404, MSG.notFound, null, 'RECORDED_LECTURE_NOT_FOUND');
  const opportunity = row.field_training_opportunities;
  await access.assertRecordedLectureReadAccess(user, opportunity);

  const page = normalizePage(query.page, 1);
  const pageSize = normalizePageSize(query.page_size ?? query.pageSize, 25);
  const search = String(query.search || '').trim().toLowerCase();
  const filterRaw = String(query.filter || 'all').trim().toLowerCase();
  const filter = FILTER_ALLOWLIST.has(filterRaw) ? filterRaw : 'all';
  const sortRaw = String(query.sort || 'progress_desc').trim().toLowerCase();
  const sort = SORT_ALLOWLIST.has(sortRaw) ? sortRaw : 'progress_desc';

  const apps = await ftRepo.findEligibleAttendanceParticipants(row.opportunity_id);
  const studentIds = apps.map((a) => a.student_id);
  const profiles = studentIds.length ? await ftRepo.findStudentProfilesByIds(studentIds) : [];
  const profileById = Object.fromEntries(profiles.map((u) => [u.id, u]));

  const applicationIds = apps.map((a) => a.id);
  const progressRows = applicationIds.length
    ? await prisma.field_training_recorded_lecture_progress.findMany({
        where: {
          lecture_id: lectureId,
          application_id: { in: applicationIds },
        },
        select: {
          application_id: true,
          student_id: true,
          unique_watched_seconds: true,
          total_playback_seconds: true,
          last_position_seconds: true,
          progress_percentage: true,
          started_at: true,
          last_watched_at: true,
          completed_at: true,
          video_duration_seconds: true,
          updated_at: true,
        },
      })
    : [];
  const progressByApp = new Map(progressRows.map((p) => [p.application_id, p]));

  const sessionId = row.session_id || null;
  let sessionMeta = null;
  if (row.field_training_sessions) {
    sessionMeta = {
      id: row.field_training_sessions.id,
      title: row.field_training_sessions.title,
      sessionDate: formatDateOnly(row.field_training_sessions.session_date),
    };
  } else if (sessionId) {
    const session = await prisma.field_training_sessions.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true, session_date: true },
    });
    if (session) {
      sessionMeta = {
        id: session.id,
        title: session.title,
        sessionDate: formatDateOnly(session.session_date),
      };
    }
  }

  const attendanceRows =
    sessionId && applicationIds.length
      ? await prisma.field_training_attendance.findMany({
          where: {
            session_id: sessionId,
            application_id: { in: applicationIds },
          },
          select: { application_id: true, status: true },
        })
      : [];
  const attendanceByApp = new Map(attendanceRows.map((a) => [a.application_id, a.status]));

  const allStudents = apps.map((app) => {
    const profile = profileById[app.student_id] || {};
    const progressRow = progressByApp.get(app.id) || null;
    const mapped = progressRow
      ? mapStudentProgress(progressRow, { durationSeconds: row.duration_seconds })
      : emptyStudentProgress();
    const completionStatus = mapped.watchStatus || WATCH_STATUSES.NOT_STARTED;
    const attendanceStatus = sessionId
      ? attendanceLabel(attendanceByApp.get(app.id) ?? null)
      : null;
    const needsSync =
      Boolean(sessionId) &&
      completionStatus === WATCH_STATUSES.COMPLETED &&
      attendanceStatus !== 'present';

    return {
      applicationId: app.id,
      studentId: app.student_id,
      name: profile.full_name || profile.name || null,
      studentNumber: profile.university_student_number || null,
      progressPercent: Number(mapped.progressPercentage) || 0,
      completionStatus,
      completedAt: mapped.completedAt || null,
      lastProgressAt: mapped.lastWatchedAt || progressRow?.updated_at || null,
      attendanceStatus,
      attendanceAvailable: Boolean(sessionId),
      needsSync,
    };
  });

  const summary = buildSummary(allStudents, Boolean(sessionId));

  const filtered = allStudents
    .filter((s) => matchesSearch(s, search))
    .filter((s) => matchesFilter(s, filter))
    .sort((a, b) => compareRows(a, b, sort));

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return {
    lecture: {
      id: row.id,
      title: row.title,
      sessionId,
      durationSeconds: row.duration_seconds,
      status: lectureRepo.mapLectureRow(row).status,
    },
    linkedSession: sessionMeta,
    summary,
    students,
    pagination: {
      page: safePage,
      pageSize,
      total: totalFiltered,
      totalPages,
    },
    filters: { search: search || null, filter, sort },
  };
}

module.exports = {
  listLectureStudentProgress,
  SORT_ALLOWLIST,
  FILTER_ALLOWLIST,
  buildSummary,
  WATCH_STATUSES,
};
