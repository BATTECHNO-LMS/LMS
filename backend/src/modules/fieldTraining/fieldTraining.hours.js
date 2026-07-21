/**
 * Field-training hours helpers.
 *
 * Two complementary surfaces:
 * 1) Attendance-derived progress (`buildHoursProgress`) — completed hours from
 *    approved attendance × session duration (no duplicated stored totals needed).
 * 2) Model A aggregate (`buildHoursSummary`) — reads
 *    `field_training_applications.completed_training_hours` (REPLACE write semantics).
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

function toNullableInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Model A summary from stored application aggregate hours.
 * @param {{ completed_training_hours?: unknown, hours_updated_at?: unknown }} app
 * @param {{ required_training_hours?: unknown }} opp
 */
function buildHoursSummary(app = {}, opp = {}) {
  const required = toNullableInt(opp.required_training_hours);
  const completed = toNullableInt(app.completed_training_hours);
  const remaining =
    required != null && completed != null ? Math.max(0, required - completed) : null;
  const hoursProgressPercentage =
    required != null && required > 0 && completed != null
      ? Math.min(100, Math.round((completed / required) * 100))
      : null;

  return {
    required_training_hours: required,
    completed_training_hours: completed,
    remaining_training_hours: remaining,
    hours_progress_percentage: hoursProgressPercentage,
    hours_updated_at: app.hours_updated_at ?? null,
    hours_configured: required != null,
    hours_recorded: completed != null,
  };
}

/**
 * Validate a replacement completed-hours value against opportunity required hours.
 * @returns {{ ok: true, value: number } | { ok: false, status: number, message: string, code: string }}
 */
function validateCompletedHoursReplacement(completedHours, requiredHours) {
  if (completedHours == null || completedHours === '') {
    return {
      ok: false,
      status: 422,
      message: 'يجب إدخال عدد ساعات مكتملة صالح.',
      code: 'HOURS_REQUIRED',
    };
  }
  const value = Number(completedHours);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المكتملة يجب أن تكون عدداً صحيحاً.',
      code: 'HOURS_INVALID_PRECISION',
    };
  }
  if (value < 0) {
    return {
      ok: false,
      status: 422,
      message: 'لا يمكن أن تكون الساعات المكتملة سالبة.',
      code: 'HOURS_NEGATIVE',
    };
  }
  if (value > 10000) {
    return {
      ok: false,
      status: 422,
      message: 'قيمة الساعات المكتملة تتجاوز الحد المسموح.',
      code: 'HOURS_TOO_LARGE',
    };
  }
  const required = toNullableInt(requiredHours);
  if (required != null && value > required) {
    return {
      ok: false,
      status: 422,
      message: `لا يمكن أن تتجاوز الساعات المكتملة الساعات المطلوبة (${required}).`,
      code: 'HOURS_EXCEED_REQUIRED',
    };
  }
  return { ok: true, value };
}

/**
 * Validate required-hours value for opportunity create/update.
 * null clears the target; positive integers only when provided.
 */
function validateRequiredHoursValue(requiredHours) {
  if (requiredHours === undefined) {
    return { ok: true, skipped: true };
  }
  if (requiredHours === null || requiredHours === '') {
    return { ok: true, value: null };
  }
  const value = Number(requiredHours);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة يجب أن تكون عدداً صحيحاً.',
      code: 'REQUIRED_HOURS_INVALID',
    };
  }
  if (value <= 0) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة يجب أن تكون أكبر من صفر عند تحديدها.',
      code: 'REQUIRED_HOURS_NOT_POSITIVE',
    };
  }
  if (value > 10000) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة تتجاوز الحد المسموح.',
      code: 'REQUIRED_HOURS_TOO_LARGE',
    };
  }
  return { ok: true, value };
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
  toNullableInt,
  buildHoursSummary,
  validateCompletedHoursReplacement,
  validateRequiredHoursValue,
};
