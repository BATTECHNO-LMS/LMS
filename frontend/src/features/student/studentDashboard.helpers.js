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

/** Profile completeness 0–100 from available auth fields (no student_number in schema). */
export function computeProfileCompleteness(user) {
  if (!user) return 0;
  const checks = [
    Boolean(user.full_name || user.name),
    Boolean(user.email),
    Boolean(user.university?.name || user.primary_university?.name),
    Boolean(user.specialty?.id || user.specialty_id),
    Boolean(user.status),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function specialtyDisplayName(specialty, lang = 'ar') {
  if (!specialty) return null;
  if (lang?.startsWith('en') && specialty.name_en) return specialty.name_en;
  return specialty.name_ar || specialty.name_en || specialty.code || null;
}

/** Courses the student has started / enrolled in (course_enrollments). */
export function filterEnrolledCourses(courses = []) {
  return courses.filter((c) => {
    const st = String(c.enrollment_status || '').toLowerCase();
    return st === 'active' || st === 'completed';
  });
}

export function averageCourseProgress(courses = []) {
  const enrolled = filterEnrolledCourses(courses);
  if (!enrolled.length) return 0;
  const sum = enrolled.reduce((acc, c) => acc + (Number(c.progress_percent) || 0), 0);
  return Math.round(sum / enrolled.length);
}

/**
 * Attendance breakdown from sessions that include my_attendance_status.
 * @param {{ my_attendance_status?: string | null }[]} sessions
 */
export function buildAttendanceBreakdown(sessions = []) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0, recorded: 0, total: sessions.length };
  for (const s of sessions) {
    const st = String(s.my_attendance_status || '').toLowerCase();
    if (!st) continue;
    counts.recorded += 1;
    if (st === 'present') counts.present += 1;
    else if (st === 'absent') counts.absent += 1;
    else if (st === 'late') counts.late += 1;
    else if (st === 'excused') counts.excused += 1;
  }
  const attended = counts.present + counts.late + counts.excused;
  const pct =
    counts.recorded > 0 ? Math.round((attended / counts.recorded) * 1000) / 10 : null;
  return { ...counts, percentage: pct };
}

/**
 * Derive FT next action from application + opportunity (mirrors backend resolveNextAction).
 * @returns {{ key: string, label_ar: string } | null}
 */
export function deriveFieldTrainingNextAction(app, opp = {}) {
  if (!app) return null;
  if (app.status === 'pending') return { key: 'await_application_review', label_ar: 'انتظار مراجعة الطلب' };
  if (app.status === 'rejected') return { key: 'application_rejected', label_ar: 'تم رفض الطلب' };
  if (app.training_status === 'expelled' || app.status === 'cancelled') {
    return { key: 'expelled', label_ar: 'مستبعد من التدريب' };
  }
  if (app.training_status === 'pre_assessment_pending' && opp.requires_pre_assessment !== false) {
    return { key: 'complete_pre_assessment', label_ar: 'أكمل التقييم القبلي' };
  }
  if (['ready_for_training', 'pre_assessment_completed'].includes(app.training_status)) {
    return { key: 'await_training_start', label_ar: 'انتظار بدء التدريب' };
  }
  if (app.training_status === 'task_pending') {
    return { key: 'submit_task', label_ar: 'لديك مهمة تنتظر التسليم' };
  }
  if (app.training_status === 'post_assessment_pending' && opp.requires_post_assessment !== false) {
    return { key: 'complete_post_assessment', label_ar: 'أكمل التقييم البعدي' };
  }
  if (app.completion_eligibility_status === 'eligible' && !app.completion_letter_issued_at) {
    return { key: 'await_completion_letter', label_ar: 'بانتظار إصدار كتاب إنهاء التدريب' };
  }
  if (app.completion_letter_issued_at || app.training_status === 'completed') {
    return { key: 'completed', label_ar: 'تم إصدار كتاب إنهاء التدريب' };
  }
  if (app.training_status === 'in_training') {
    return { key: 'continue_training', label_ar: 'تابع التدريب والمهام والجلسات' };
  }
  return { key: 'continue_training', label_ar: 'تابع التدريب الميداني' };
}

export function isActiveFieldTrainingApplication(app) {
  if (!app) return false;
  if (['rejected', 'cancelled'].includes(String(app.status))) return false;
  if (app.training_status === 'expelled') return false;
  return true;
}

/** Hide Zod / React Query context leaks from end users. */
export function friendlySectionError(err, fallbackAr) {
  const raw = err?.response?.data?.message || err?.message || '';
  const s = String(raw);
  if (/Unrecognized key|queryKey|signal|page_size|Zod|strict/i.test(s)) {
    return fallbackAr;
  }
  if (s && s.length < 160 && !/client|queryKey|signal/i.test(s)) return s;
  return fallbackAr;
}

export function latestGrade(grades = []) {
  const sorted = sortGradesRecentFirst(grades);
  return sorted[0] ?? null;
}

export function countIssuedCertificates(certificates = []) {
  return certificates.filter((c) => String(c.status || '').toLowerCase() === 'issued').length;
}

export function countReadyCompletionLetters(applications = []) {
  return applications.filter((a) => Boolean(a.completion_letter_issued_at)).length;
}
