/**
 * Field-training hours progress — single source of truth.
 * Completed hours are derived from approved attendance × session duration (start/end times).
 * No duplicated stored totals on applications.
 */

const { prisma } = require('../../config/db');

/** Attendance statuses that count toward completed training hours. */
const HOURS_ATTENDED_STATUSES = new Set(['present', 'late', 'excused']);

const HOURS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

function parseTimeToMinutes(value) {
  if (value == null || value === '') return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Duration in minutes from start/end clock times.
 * Returns null when times are missing or end <= start (same-day sessions only).
 */
function sessionDurationMinutes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  const diff = end - start;
  return diff > 0 ? diff : null;
}

function roundHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value) * 100) / 100;
}

function minutesToHours(minutes) {
  return roundHours((Number(minutes) || 0) / 60);
}

/**
 * @param {{ requiredHours?: number | null, completedMinutes?: number }} input
 */
function buildHoursProgress({ requiredHours = null, completedMinutes = 0 } = {}) {
  const required =
    requiredHours != null && requiredHours !== '' && Number.isFinite(Number(requiredHours))
      ? Number(requiredHours)
      : null;
  const completed = minutesToHours(completedMinutes);
  const remaining =
    required == null ? null : roundHours(Math.max(0, required - completed));
  const excess =
    required != null && completed > required ? roundHours(completed - required) : 0;

  let percentage = null;
  if (required != null && required > 0) {
    percentage = Math.min(100, roundHours((completed / required) * 100));
  }

  let status = null;
  if (required != null && required > 0) {
    if (completed <= 0) status = HOURS_STATUS.NOT_STARTED;
    else if (completed >= required) status = HOURS_STATUS.COMPLETED;
    else status = HOURS_STATUS.IN_PROGRESS;
  }

  return {
    required_training_hours: required,
    completed_training_hours: completed,
    remaining_training_hours: remaining,
    excess_training_hours: excess,
    hours_completion_percentage: percentage,
    hours_completion_status: status,
  };
}

function hoursStatusLabelAr(status) {
  if (status === HOURS_STATUS.NOT_STARTED) return 'لم يبدأ';
  if (status === HOURS_STATUS.IN_PROGRESS) return 'قيد الإنجاز';
  if (status === HOURS_STATUS.COMPLETED) return 'مكتمل';
  return '—';
}

/**
 * Sum session durations for attended records (unique sessions).
 * @param {Array<{ status: string, field_training_sessions?: { start_time?: string, end_time?: string } | null }>} records
 */
function sumCompletedMinutesFromRecords(records) {
  const seen = new Set();
  let total = 0;
  for (const row of records || []) {
    if (!HOURS_ATTENDED_STATUSES.has(row.status)) continue;
    const sessionId = row.session_id || row.field_training_sessions?.id;
    if (sessionId) {
      if (seen.has(sessionId)) continue;
      seen.add(sessionId);
    }
    const session = row.field_training_sessions || row.session || null;
    const minutes = sessionDurationMinutes(session?.start_time, session?.end_time);
    if (minutes != null) total += minutes;
  }
  return total;
}

/**
 * Compute completed training minutes for an application from attendance + session times.
 */
async function calculateCompletedTrainingMinutes(applicationId, tx = prisma) {
  const records = await tx.field_training_attendance.findMany({
    where: {
      application_id: applicationId,
      status: { in: [...HOURS_ATTENDED_STATUSES] },
    },
    select: {
      session_id: true,
      status: true,
      field_training_sessions: {
        select: { id: true, start_time: true, end_time: true },
      },
    },
  });
  return sumCompletedMinutesFromRecords(records);
}

/**
 * @param {string} applicationId
 * @param {number | null | undefined} requiredHours
 */
async function calculateHoursProgressForApplication(applicationId, requiredHours, tx = prisma) {
  const completedMinutes = await calculateCompletedTrainingMinutes(applicationId, tx);
  return buildHoursProgress({ requiredHours, completedMinutes });
}

/**
 * Batch hours for many applications (one query).
 * @param {Array<{ id: string, opportunity_id?: string }>} applications
 * @param {Map<string, number | null> | Record<string, number | null>} requiredByOpportunityId
 */
async function calculateHoursProgressForApplications(applications, requiredByOpportunityId, tx = prisma) {
  if (!applications?.length) return new Map();
  const ids = applications.map((a) => a.id);
  const records = await tx.field_training_attendance.findMany({
    where: {
      application_id: { in: ids },
      status: { in: [...HOURS_ATTENDED_STATUSES] },
    },
    select: {
      application_id: true,
      session_id: true,
      status: true,
      field_training_sessions: {
        select: { id: true, start_time: true, end_time: true },
      },
    },
  });

  const byApp = new Map();
  for (const id of ids) byApp.set(id, []);
  for (const row of records) {
    const list = byApp.get(row.application_id);
    if (list) list.push(row);
  }

  const getRequired = (opportunityId) => {
    if (requiredByOpportunityId instanceof Map) {
      return requiredByOpportunityId.get(opportunityId) ?? null;
    }
    return requiredByOpportunityId?.[opportunityId] ?? null;
  };

  const result = new Map();
  for (const app of applications) {
    const minutes = sumCompletedMinutesFromRecords(byApp.get(app.id) || []);
    const required =
      app.required_training_hours != null
        ? app.required_training_hours
        : getRequired(app.opportunity_id);
    result.set(app.id, buildHoursProgress({ requiredHours: required, completedMinutes: minutes }));
  }
  return result;
}

module.exports = {
  HOURS_ATTENDED_STATUSES,
  HOURS_STATUS,
  parseTimeToMinutes,
  sessionDurationMinutes,
  minutesToHours,
  roundHours,
  buildHoursProgress,
  hoursStatusLabelAr,
  sumCompletedMinutesFromRecords,
  calculateCompletedTrainingMinutes,
  calculateHoursProgressForApplication,
  calculateHoursProgressForApplications,
};
