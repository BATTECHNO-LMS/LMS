/**
 * Pure helpers for student dashboard derived views (no i18n, no React).
 */

const DAY_MS = 86_400_000;

/** @param {string | Date | null | undefined} d */
function toTime(d) {
  if (d == null) return NaN;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/**
 * @param {{ session_date?: string, start_time?: string }[]} sessions
 * @returns {typeof sessions}
 */
export function sortSessionsChronologically(sessions) {
  return [...sessions].sort((a, b) => {
    const ta = toTime(`${a.session_date ?? ''}T${a.start_time ?? '00:00:00'}`);
    const tb = toTime(`${b.session_date ?? ''}T${b.start_time ?? '00:00:00'}`);
    return ta - tb;
  });
}

/**
 * @param {{ session_date?: string, start_time?: string }[]} sessions
 * @param {{ getTime?: () => number }} [now]
 */
export function filterUpcomingSessions(sessions, now = new Date()) {
  const t0 = now.getTime();
  return sortSessionsChronologically(sessions).filter((s) => {
    const t = toTime(`${s.session_date ?? ''}T${s.start_time ?? '00:00:00'}`);
    return !Number.isNaN(t) && t >= t0 - DAY_MS;
  });
}

/** Open for student work (backend uses open; published may be informational). */
export function isOpenAssessment(a) {
  const s = String(a?.status ?? '').toLowerCase();
  return s === 'open' || s === 'published';
}

/** @param {{ assessment_id: string, submitted_at?: string, status?: string }[]} submissions */
export function latestSubmissionForAssessment(submissions, assessmentId) {
  const list = submissions.filter((s) => s.assessment_id === assessmentId);
  if (!list.length) return null;
  return [...list].sort((a, b) => toTime(b.submitted_at) - toTime(a.submitted_at))[0];
}

export function submissionNeedsWork(sub) {
  if (!sub) return true;
  const st = String(sub.status ?? '').toLowerCase();
  return st === 'draft' || st === 'returned';
}

/**
 * @param {object[]} enrollments — API enrollments with optional attendance_percentage
 */
export function averageEnrollmentAttendancePct(enrollments) {
  const nums = enrollments
    .map((e) => (e.attendance_percentage != null ? Number(e.attendance_percentage) : NaN))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/**
 * @param {{ score?: number | null, is_final?: boolean, graded_at?: string }[]} grades
 */
export function averageFinalGradePercent(grades) {
  const finals = grades.filter((g) => g.is_final && g.score != null && !Number.isNaN(Number(g.score)));
  if (!finals.length) return null;
  const avg = finals.reduce((acc, g) => acc + Number(g.score), 0) / finals.length;
  return Math.round(avg * 10) / 10;
}

/**
 * @param {{ graded_at?: string, updated_at?: string }[]} grades
 */
export function sortGradesRecentFirst(grades) {
  return [...grades].sort((a, b) => {
    const ta = toTime(a.graded_at ?? a.updated_at);
    const tb = toTime(b.graded_at ?? b.updated_at);
    return tb - ta;
  });
}
