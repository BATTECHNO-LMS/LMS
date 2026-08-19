'use strict';

/**
 * Pure helpers to compute hours/attendance requirement status from session data.
 *
 * Key rule: when sessionCount === 0 (no countable sessions exist), both hours
 * and attendance are "not measurable / not applicable" → ok = true regardless
 * of configured required thresholds.  This prevents permanently blocking trainees
 * when a course has configured required_hours / required_attendance_pct but the
 * admin hasn't yet created any countable sessions.
 */

/**
 * @param {object} params
 * @param {number} params.sessionCount - number of sessions that count toward hours
 * @param {number} params.hoursCompleted - hours actually attended
 * @param {number} params.hoursRequired - program configured required_hours (0 = none)
 * @returns {{ value: number, required: number, ok: boolean }}
 */
function computeHoursStatus({ sessionCount, hoursCompleted, hoursRequired }) {
  if (sessionCount === 0) {
    return { value: hoursCompleted, required: hoursRequired, ok: true };
  }
  const ok = !hoursRequired || hoursCompleted >= hoursRequired;
  return { value: hoursCompleted, required: hoursRequired, ok };
}

/**
 * @param {object} params
 * @param {number} params.sessionCount - number of sessions that count toward hours
 * @param {number} params.attendancePct - computed attendance percentage
 * @param {number} params.requiredAttendance - program configured required_attendance_pct (0 = none)
 * @returns {{ value: number, required: number, ok: boolean }}
 */
function computeAttendanceStatus({ sessionCount, attendancePct, requiredAttendance }) {
  if (sessionCount === 0) {
    return { value: attendancePct, required: requiredAttendance, ok: true };
  }
  const ok = !requiredAttendance || attendancePct >= requiredAttendance;
  return { value: attendancePct, required: requiredAttendance, ok };
}

/**
 * Map a persisted training_progress row to the API snapshot shape.
 * @param {object|null|undefined} row
 * @param {string} [enrollmentId]
 */
function snapshotFromProgressRow(row, enrollmentId) {
  if (!row) return null;
  return {
    enrollmentId: enrollmentId || row.enrollment_id,
    completionPct: Number(row.completion_pct),
    hoursCompleted: Number(row.hours_completed),
    attendancePct: Number(row.attendance_pct || 0),
    status: row.status,
    requirements: row.requirements_json,
  };
}

module.exports = { computeHoursStatus, computeAttendanceStatus, snapshotFromProgressRow };
