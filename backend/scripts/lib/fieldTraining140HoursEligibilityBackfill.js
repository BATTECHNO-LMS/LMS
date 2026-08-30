'use strict';

const {
  resolveAttemptStatus,
  ATTEMPT_STATUS,
} = require('../../src/modules/fieldTraining/fieldTraining.standardizedPostAssessment');
const { hasActualStudentSubmission } = require('./gradeFieldTrainingTaskSubmissions');

const OPERATION_ID = 'FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1';
const TARGET_HOURS = 140;
const MIN_ATTENDANCE_PERCENT = 80;
const ELIGIBLE = 'eligible';

const SKIPPED_APPLICATION_STATUSES = new Set(['pending', 'rejected', 'cancelled']);
const SKIPPED_TRAINING_STATUSES = new Set(['expelled']);
const SKIPPED_OPPORTUNITY_STATUSES = new Set(['cancelled']);

const VALID_ATTEMPT_KEYS = new Set([
  'submitted',
  'auto_graded',
  'graded',
  'reviewed',
  'completed',
]);
const INVALID_ATTEMPT_KEYS = new Set(['not_started', 'in_progress', 'draft', 'cancelled', 'deleted']);

const VALID_TASK_REVIEW_STATUSES = new Set([
  'submitted',
  'under_review',
  'graded',
  'approved',
  'pending',
]);
const INVALID_TASK_REVIEW_STATUSES = new Set([
  'draft',
  'missing',
  'deleted',
  'cancelled',
  'needs_revision',
  'rejected',
]);

const ATTENDED_STATUSES = new Set(['present', 'late', 'excused']);
const NON_COUNTABLE_SESSION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'deleted',
  'postponed',
  'draft',
  'inactive',
]);

function toIntHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function isValidSubmittedAttempt(attempt) {
  if (!attempt) return false;
  if (attempt.deleted_at || attempt.archived_at) return false;
  const status = resolveAttemptStatus(attempt, attempt.score);
  if (INVALID_ATTEMPT_KEYS.has(status.key)) return false;
  if (VALID_ATTEMPT_KEYS.has(status.key)) return Boolean(attempt.submitted_at) || status.key === 'graded';
  return Boolean(attempt.submitted_at);
}

function attemptMatchesEnrollment(attempt, assessment, application) {
  if (!attempt || !assessment || !application) return false;
  if (String(attempt.application_id) !== String(application.id)) return false;
  if (String(attempt.student_id) !== String(application.student_id)) return false;
  if (String(attempt.assessment_id) !== String(assessment.id)) return false;
  if (String(assessment.opportunity_id) !== String(application.opportunity_id)) return false;
  return true;
}

function findValidAttempt({ application, assessments, attempts, type }) {
  const typed = (assessments || []).filter(
    (row) => row.type === type && String(row.opportunity_id) === String(application.opportunity_id)
  );
  for (const assessment of typed) {
    const match = (attempts || []).find(
      (attempt) =>
        attemptMatchesEnrollment(attempt, assessment, application) && isValidSubmittedAttempt(attempt)
    );
    if (match) return match;
  }
  return null;
}

function isCountableSession(session, opportunityId) {
  if (!session) return false;
  if (session.deleted_at || session.archived_at) return false;
  if (session.is_required === false) return false;
  if (String(session.opportunity_id) !== String(opportunityId)) return false;
  const status = String(session.status || session.session_status || '').toLowerCase();
  if (status && NON_COUNTABLE_SESSION_STATUSES.has(status)) return false;
  return true;
}

function attendanceMeetsThreshold(attended, total) {
  const counted = Math.max(0, Number(total) || 0);
  const present = Math.max(0, Number(attended) || 0);
  if (counted <= 0) {
    return { ok: false, percent: null, attended: present, total: counted, reason: 'zero_sessions' };
  }
  const percent = (present / counted) * 100;
  return {
    ok: percent >= MIN_ATTENDANCE_PERCENT,
    percent,
    attended: present,
    total: counted,
    reason: percent >= MIN_ATTENDANCE_PERCENT ? null : 'attendance_below_80',
  };
}

function computeAttendanceForEnrollment({ application, sessions, attendanceRows }) {
  const countable = (sessions || []).filter((session) =>
    isCountableSession(session, application.opportunity_id)
  );
  const sessionIds = new Set(countable.map((session) => String(session.id)));
  const seen = new Set();
  let attended = 0;
  for (const row of attendanceRows || []) {
    if (String(row.application_id) !== String(application.id)) continue;
    if (String(row.student_id) !== String(application.student_id)) continue;
    const sessionId = String(row.session_id);
    if (!sessionIds.has(sessionId) || seen.has(sessionId)) continue;
    seen.add(sessionId);
    if (ATTENDED_STATUSES.has(row.status)) attended += 1;
  }
  return attendanceMeetsThreshold(attended, countable.length);
}

function isValidTaskSubmission(submission, application, task) {
  if (!submission || !application || !task) return false;
  if (submission.deleted_at || submission.archived_at) return false;
  if (String(submission.application_id) !== String(application.id)) return false;
  if (String(submission.student_id) !== String(application.student_id)) return false;
  if (String(submission.task_id) !== String(task.id)) return false;
  if (String(task.opportunity_id) !== String(application.opportunity_id)) return false;
  if (task.deleted_at || task.archived_at) return false;
  const status = String(task.status || '').toLowerCase();
  if (status && ['draft', 'cancelled', 'deleted', 'archived'].includes(status)) return false;
  const review = String(submission.review_status || '').toLowerCase();
  if (INVALID_TASK_REVIEW_STATUSES.has(review)) return false;
  if (!VALID_TASK_REVIEW_STATUSES.has(review)) return false;
  if (!submission.submitted_at) return false;
  return hasActualStudentSubmission(submission);
}

function findValidTaskSubmission({ application, tasks, submissions }) {
  const scopedTasks = (tasks || []).filter(
    (task) => String(task.opportunity_id) === String(application.opportunity_id)
  );
  for (const task of scopedTasks) {
    const match = (submissions || []).find((row) => isValidTaskSubmission(row, application, task));
    if (match) return match;
  }
  return null;
}

function skipEnrollment(application, opportunity) {
  if (!application) return 'application_missing';
  if (SKIPPED_OPPORTUNITY_STATUSES.has(String(opportunity?.status || ''))) return 'opportunity_cancelled';
  if (SKIPPED_APPLICATION_STATUSES.has(String(application.status || ''))) return 'enrollment_not_accepted';
  if (SKIPPED_TRAINING_STATUSES.has(String(application.training_status || '')) || application.expelled_at) {
    return 'enrollment_expelled';
  }
  return null;
}

function proposedHours(currentHours) {
  return Math.max(toIntHours(currentHours), TARGET_HOURS);
}

function evaluateEnrollment({
  application,
  opportunity,
  assessments = [],
  attempts = [],
  tasks = [],
  submissions = [],
  sessions = [],
  attendanceRows = [],
} = {}) {
  const skipReason = skipEnrollment(application, opportunity);
  const currentHours = toIntHours(application?.completed_training_hours);
  const currentEligibility = application?.completion_eligibility_status || 'pending';
  const base = {
    applicationId: application?.id || null,
    studentId: application?.student_id || null,
    opportunityId: application?.opportunity_id || opportunity?.id || null,
    universityId: opportunity?.university_id || null,
    currentHours,
    proposedHours: currentHours,
    currentEligibility,
    proposedEligibility: currentEligibility,
    qualifies: false,
    needsUpdate: false,
    skipReason,
    missing: [],
    preAttemptId: null,
    taskSubmissionId: null,
    postAttemptId: null,
    attendance: { attended: 0, total: 0, percent: null },
    integrityErrors: [],
  };
  if (skipReason) return base;

  const pre = findValidAttempt({ application, assessments, attempts, type: 'pre' });
  const post = findValidAttempt({ application, assessments, attempts, type: 'post' });
  const task = findValidTaskSubmission({ application, tasks, submissions });
  const attendance = computeAttendanceForEnrollment({ application, sessions, attendanceRows });

  const missing = [];
  if (!pre) missing.push('pre_assessment');
  if (!task) missing.push('task_submission');
  if (!post) missing.push('post_assessment');
  if (!attendance.ok) missing.push(attendance.reason || 'attendance_below_80');

  const qualifies = missing.length === 0;
  const nextHours = qualifies ? proposedHours(currentHours) : currentHours;
  const nextEligibility = qualifies ? ELIGIBLE : currentEligibility;
  const alreadyAtTarget = qualifies && currentHours >= TARGET_HOURS && currentEligibility === ELIGIBLE;

  return {
    ...base,
    proposedHours: nextHours,
    proposedEligibility: nextEligibility,
    qualifies,
    needsUpdate: qualifies && !alreadyAtTarget && (nextHours !== currentHours || nextEligibility !== currentEligibility),
    alreadyAtTarget,
    hoursRaised: qualifies && currentHours < TARGET_HOURS,
    hoursPreservedAboveTarget: qualifies && currentHours > TARGET_HOURS,
    skipReason: null,
    missing,
    preAttemptId: pre?.id || null,
    taskSubmissionId: task?.id || null,
    postAttemptId: post?.id || null,
    attendance: {
      attended: attendance.attended,
      total: attendance.total,
      percent: attendance.percent,
    },
  };
}

function collectIntegrityErrors({ applications, attempts, submissions, attendanceRows, assessments, tasks, sessions }) {
  const errors = [];
  const seenEnrollment = new Set();
  for (const app of applications || []) {
    const key = `${app.opportunity_id}::${app.student_id}`;
    if (seenEnrollment.has(key)) {
      errors.push({
        code: 'duplicate_enrollment',
        applicationId: app.id,
        opportunityId: app.opportunity_id,
        studentId: app.student_id,
      });
    }
    seenEnrollment.add(key);
  }

  const appById = new Map((applications || []).map((row) => [String(row.id), row]));
  const assessmentById = new Map((assessments || []).map((row) => [String(row.id), row]));
  const taskById = new Map((tasks || []).map((row) => [String(row.id), row]));
  const sessionById = new Map((sessions || []).map((row) => [String(row.id), row]));

  for (const attempt of attempts || []) {
    const app = appById.get(String(attempt.application_id));
    const assessment = assessmentById.get(String(attempt.assessment_id));
    if (!app || !assessment) continue;
    if (String(attempt.student_id) !== String(app.student_id)) {
      errors.push({ code: 'attempt_student_mismatch', attemptId: attempt.id, applicationId: app.id });
    }
    if (String(assessment.opportunity_id) !== String(app.opportunity_id)) {
      errors.push({ code: 'attempt_cross_opportunity', attemptId: attempt.id, applicationId: app.id });
    }
  }

  for (const submission of submissions || []) {
    const app = appById.get(String(submission.application_id));
    const task = taskById.get(String(submission.task_id));
    if (!app || !task) continue;
    if (String(submission.student_id) !== String(app.student_id)) {
      errors.push({ code: 'submission_student_mismatch', submissionId: submission.id, applicationId: app.id });
    }
    if (String(task.opportunity_id) !== String(app.opportunity_id)) {
      errors.push({ code: 'submission_cross_opportunity', submissionId: submission.id, applicationId: app.id });
    }
  }

  for (const row of attendanceRows || []) {
    const app = appById.get(String(row.application_id));
    const session = sessionById.get(String(row.session_id));
    if (!app || !session) continue;
    if (String(row.student_id) !== String(app.student_id)) {
      errors.push({ code: 'attendance_student_mismatch', attendanceId: row.id, applicationId: app.id });
    }
    if (String(session.opportunity_id) !== String(app.opportunity_id)) {
      errors.push({ code: 'attendance_cross_opportunity', attendanceId: row.id, applicationId: app.id });
    }
  }

  return errors;
}

function emptyExclusionCounts() {
  return {
    pre_assessment: 0,
    task_submission: 0,
    post_assessment: 0,
    attendance_below_80: 0,
    zero_sessions: 0,
    enrollment_not_accepted: 0,
    enrollment_expelled: 0,
    opportunity_cancelled: 0,
  };
}

function summarizeEvaluations(rows, { opportunitiesScanned = 0, integrityErrors = [] } = {}) {
  const exclusions = emptyExclusionCounts();
  let scanned = 0;
  let qualifying = 0;
  let toUpdate = 0;
  let hoursRaised = 0;
  let alreadyAtOrAbove = 0;
  let skipped = 0;
  for (const row of rows || []) {
    scanned += 1;
    if (row.skipReason) {
      skipped += 1;
      if (exclusions[row.skipReason] != null) exclusions[row.skipReason] += 1;
      continue;
    }
    if (row.qualifies) {
      qualifying += 1;
      if (row.hoursRaised) hoursRaised += 1;
      if (row.currentHours >= TARGET_HOURS) alreadyAtOrAbove += 1;
      if (row.needsUpdate) toUpdate += 1;
    }
    for (const reason of row.missing || []) {
      if (exclusions[reason] != null) exclusions[reason] += 1;
    }
  }
  return {
    operation: OPERATION_ID,
    opportunitiesScanned,
    enrollmentsScanned: scanned,
    qualifying,
    toUpdate,
    hoursRaised,
    alreadyAtOrAbove,
    skipped,
    exclusions,
    integrityErrors,
    integrityErrorCount: integrityErrors.length,
  };
}

function buildAuditPayload(row, actor) {
  return {
    userId: actor?.id || null,
    universityId: row.universityId || null,
    actionType: OPERATION_ID,
    entityType: 'field_training_application',
    entityId: row.applicationId,
    oldValues: {
      completed_training_hours: row.currentHours,
      completion_eligibility_status: row.currentEligibility,
    },
    newValues: {
      operation: OPERATION_ID,
      student_id: row.studentId,
      enrollment_id: row.applicationId,
      opportunity_id: row.opportunityId,
      university_id: row.universityId,
      previous_completed_hours: row.currentHours,
      new_completed_hours: row.proposedHours,
      previous_eligibility_status: row.currentEligibility,
      new_eligibility_status: row.proposedEligibility,
      pre_assessment_attempt_id: row.preAttemptId,
      counted_task_submission_id: row.taskSubmissionId,
      post_assessment_attempt_id: row.postAttemptId,
      attendance_numerator: row.attendance?.attended ?? null,
      attendance_denominator: row.attendance?.total ?? null,
      attendance_percentage: row.attendance?.percent ?? null,
      acting_admin_id: actor?.id || null,
      executed_at: new Date().toISOString(),
    },
  };
}

function applicationUpdateData(row, actor, now = new Date()) {
  return {
    completed_training_hours: row.proposedHours,
    hours_updated_at: now,
    hours_updated_by_id: actor?.id || null,
    completion_eligibility_status: row.proposedEligibility,
    eligibility_reason: {
      operation: OPERATION_ID,
      reasons: [],
      details: {
        backfill: OPERATION_ID,
        pre_assessment_attempt_id: row.preAttemptId,
        counted_task_submission_id: row.taskSubmissionId,
        post_assessment_attempt_id: row.postAttemptId,
        attendance: row.attendance,
      },
    },
    updated_at: now,
  };
}

module.exports = {
  OPERATION_ID,
  TARGET_HOURS,
  MIN_ATTENDANCE_PERCENT,
  ELIGIBLE,
  ATTEMPT_STATUS,
  isValidSubmittedAttempt,
  attendanceMeetsThreshold,
  computeAttendanceForEnrollment,
  isValidTaskSubmission,
  evaluateEnrollment,
  collectIntegrityErrors,
  summarizeEvaluations,
  buildAuditPayload,
  applicationUpdateData,
  proposedHours,
};
