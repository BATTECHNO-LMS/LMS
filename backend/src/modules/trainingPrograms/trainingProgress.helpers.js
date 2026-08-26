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

function resolveSessionHours(session) {
  if (!session) return null;
  if (session.hours != null && Number(session.hours) > 0) return Number(session.hours);
  if (session.starts_at && session.ends_at) {
    const ms = new Date(session.ends_at) - new Date(session.starts_at);
    if (Number.isFinite(ms) && ms > 0) return ms / 3600000;
  }
  return null;
}

/**
 * Pure requirement snapshot from already-loaded program/learner rows.
 * Shared by computeAndPersistProgress (write path) and batched readiness (read path).
 */
function buildProgressRequirements({
  program,
  sessions,
  attendance,
  requiredTasks,
  submissions,
  reqRows,
  assessments,
  finalTaskRow,
  evaluationAssignment,
}) {
  const countableIds = new Set((sessions || []).map((s) => s.id));
  const presentLike = (attendance || []).filter(
    (a) =>
      countableIds.has(a.session_id) && ['present', 'late', 'excused'].includes(String(a.status).toLowerCase())
  );
  const attendancePct = sessions.length ? (presentLike.length / sessions.length) * 100 : 0;
  const hoursBySession = new Map((sessions || []).map((s) => [s.id, resolveSessionHours(s)]));
  const hoursCompleted = presentLike.reduce((sum, a) => {
    const hours = hoursBySession.get(a.session_id);
    return hours == null ? sum : sum + hours;
  }, 0);
  const hoursMeasurableCount = (sessions || []).filter((s) => hoursBySession.get(s.id) != null).length;
  const hoursRequired = Number(program?.required_hours || 0);
  const requiredAttendance = Number(program?.required_attendance_pct || 0);

  const completedTaskIds = new Set((submissions || []).map((s) => s.task_id));
  const tasksDone = (requiredTasks || []).filter((t) => completedTaskIds.has(t.id)).length;

  const reqByCode = Object.fromEntries((reqRows || []).map((r) => [r.code, r]));
  function assessmentOk(kind) {
    const cfg = reqByCode[kind];
    if (!cfg?.is_required) return { required: false, ok: true, value: null };
    const assessment = (assessments || []).find((a) => a.kind === kind);
    if (!assessment) return { required: true, ok: false, value: 0, completed: false, passed: false };
    const threshold = cfg.threshold_json && typeof cfg.threshold_json === 'object' ? cfg.threshold_json : {};
    const passScoreRaw = assessment.pass_score ?? threshold.pass_score;
    const passScore = passScoreRaw != null ? Number(passScoreRaw) : null;
    const passingRequired = threshold.passing_required === true || (passScore != null && threshold.passing_required !== false);
    const attempts = assessment.training_assessment_attempts || assessment.attempts || [];
    const pendingManual = attempts.some((a) => a.status === 'SUBMITTED' && !a.graded_at);
    const graded = attempts.filter((a) => a.status === 'GRADED');
    const submittedOrGraded = attempts.filter((a) => ['SUBMITTED', 'GRADED'].includes(a.status));
    const best = graded.reduce((max, a) => Math.max(max, Number(a.score || 0)), 0);
    const completed = submittedOrGraded.length > 0 && !pendingManual;
    const passed = passingRequired ? completed && best >= Number(passScore || 0) : completed;
    return {
      required: true,
      ok: passed,
      value: best,
      passScore,
      passingRequired,
      completed,
      passed,
      pendingManual,
    };
  }

  let finalTaskCheck = { required: false, ok: true };
  if (reqByCode.FINAL_TASK?.is_required) {
    if (!finalTaskRow) {
      finalTaskCheck = { required: true, ok: false, reason: 'NO_FINAL_TASK_CONFIGURED' };
    } else {
      const submission = (submissions || [])
        .filter((s) => s.task_id === finalTaskRow.id)
        .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];
      finalTaskCheck = {
        required: true,
        ok: Boolean(submission),
        submitted: Boolean(submission),
        score: submission?.score != null ? Number(submission.score) : null,
      };
    }
  }

  let evaluationCheck = { required: false, ok: true };
  if (reqByCode.EVALUATION?.is_required) {
    evaluationCheck = {
      required: true,
      ok: evaluationAssignment?.status === 'SUBMITTED',
      submitted: evaluationAssignment?.status === 'SUBMITTED',
      status: evaluationAssignment?.status || 'LOCKED',
    };
  }

  const requirements = {
    attendance: computeAttendanceStatus({ sessionCount: sessions.length, attendancePct, requiredAttendance }),
    hours: computeHoursStatus({ sessionCount: hoursMeasurableCount, hoursCompleted, hoursRequired }),
    tasks: {
      value: tasksDone,
      required: reqByCode.TASKS?.is_required === false ? 0 : (requiredTasks || []).length,
      ok: reqByCode.TASKS?.is_required === false ? true : tasksDone >= (requiredTasks || []).length,
    },
    preTest: assessmentOk('PRE_TEST'),
    postTest: assessmentOk('POST_TEST'),
    finalTask: finalTaskCheck,
    evaluation: evaluationCheck,
  };
  const allOk = Object.values(requirements).every((r) => r.ok);
  const requirementChecks = Object.values(requirements);
  const completionPct = allOk
    ? 100
    : Math.min(
        99,
        Math.round((requirementChecks.filter((r) => r.ok).length / Math.max(requirementChecks.length, 1)) * 100)
      );

  return {
    requirements,
    completionPct,
    hoursCompleted,
    attendancePct,
    allOk,
  };
}

module.exports = {
  computeHoursStatus,
  computeAttendanceStatus,
  snapshotFromProgressRow,
  resolveSessionHours,
  buildProgressRequirements,
};
