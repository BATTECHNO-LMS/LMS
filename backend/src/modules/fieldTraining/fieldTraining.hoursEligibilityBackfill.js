'use strict';

/**
 * One-time idempotent backfill:
 * FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1
 *
 * Qualifying approved enrollments (same opportunity only):
 * 1. Valid submitted pre-assessment attempt
 * 2. At least one valid task submission
 * 3. Valid submitted post-assessment attempt
 * 4. Attendance >= 80.00% on counted required sessions (no rounding up)
 *
 * Then: completed_training_hours = max(current, 140), eligibility = eligible.
 */

const { prisma: defaultPrisma } = require('../../config/db');
const { recordAudit } = require('../../shared/services/audit.service');
const hoursMod = require('./fieldTraining.hours');

const OPERATION_ID = 'FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1';
const TARGET_HOURS = 140;
const MIN_ATTENDANCE_PERCENT = 80;

const VALID_TASK_REVIEW_STATUSES = Object.freeze([
  'submitted',
  'under_review',
  'graded',
  'approved',
]);

const SKIPPED_APPLICATION_STATUSES = Object.freeze(['pending', 'rejected', 'cancelled']);
const TERMINAL_TRAINING_STATUSES = Object.freeze(['completed', 'expelled', 'failed']);

function isValidSubmittedAttempt(attempt) {
  return Boolean(attempt?.id && attempt.submitted_at);
}

function isValidTaskSubmission(submission, application) {
  if (!submission?.id) return false;
  if (!VALID_TASK_REVIEW_STATUSES.includes(submission.review_status)) return false;
  if (submission.application_id !== application.id) return false;
  if (submission.student_id !== application.student_id) return false;
  if (submission.opportunity_id && submission.opportunity_id !== application.opportunity_id) {
    return false;
  }
  return true;
}

/**
 * Exact 80% floor: attended/counted * 100 >= 80, with no rounding.
 * 0 counted sessions never qualifies.
 */
function qualifiesAttendance(attended, counted) {
  const a = Number(attended) || 0;
  const c = Number(counted) || 0;
  if (c <= 0) return false;
  return a * 100 >= c * MIN_ATTENDANCE_PERCENT;
}

function exactAttendancePercent(attended, counted) {
  const c = Number(counted) || 0;
  if (c <= 0) return null;
  return (Number(attended) / c) * 100;
}

function canonicalAttendancePercent(attended, counted) {
  const c = Number(counted) || 0;
  if (c <= 0) return null;
  return Math.round((Number(attended) / c) * 10000) / 100;
}

function proposedCompletedHours(currentHours) {
  const current = hoursMod.toNullableInt(currentHours) || 0;
  return current >= TARGET_HOURS ? current : TARGET_HOURS;
}

function needsMutation(application, proposedHours) {
  const currentHours = hoursMod.toNullableInt(application.completed_training_hours) || 0;
  if (currentHours !== proposedHours) return true;
  if (application.completion_eligibility_status !== 'eligible') return true;
  return false;
}

function evaluateEnrollment(input) {
  const {
    application,
    opportunity,
    preAttempt,
    postAttempt,
    taskSubmission,
    attendedCountedSessions,
    totalCountedSessions,
  } = input;

  const skipReasons = [];
  const integrityErrors = [];

  if (!application?.id) {
    integrityErrors.push('missing_application');
    return { qualify: false, skipReasons, integrityErrors, exclusion: 'invalid_row' };
  }
  if (!opportunity?.id || opportunity.id !== application.opportunity_id) {
    integrityErrors.push('opportunity_mismatch');
  }
  if (SKIPPED_APPLICATION_STATUSES.includes(application.status)) {
    skipReasons.push('enrollment_not_accepted');
  }
  if (application.training_status === 'expelled' || application.expelled_at) {
    skipReasons.push('expelled');
  }

  const preOk = isValidSubmittedAttempt(preAttempt);
  const taskOk = isValidTaskSubmission(taskSubmission, application);
  const postOk = isValidSubmittedAttempt(postAttempt);
  const attendanceOk = qualifiesAttendance(attendedCountedSessions, totalCountedSessions);

  const missing = [];
  if (!preOk) missing.push('pre_assessment');
  if (!taskOk) missing.push('task_submission');
  if (!postOk) missing.push('post_assessment');
  if (!attendanceOk) {
    missing.push(Number(totalCountedSessions) > 0 ? 'attendance_below_80' : 'zero_counted_sessions');
  }

  const proposedHours = proposedCompletedHours(application.completed_training_hours);
  const attendancePercentageExact = exactAttendancePercent(
    attendedCountedSessions,
    totalCountedSessions
  );
  const attendancePercentageCanonical = canonicalAttendancePercent(
    attendedCountedSessions,
    totalCountedSessions
  );

  const qualify = skipReasons.length === 0 && missing.length === 0 && integrityErrors.length === 0;
  const mutate = qualify && needsMutation(application, proposedHours);

  return {
    qualify,
    mutate,
    skipReasons,
    missing,
    integrityErrors,
    proposedHours,
    currentHours: hoursMod.toNullableInt(application.completed_training_hours) || 0,
    currentEligibility: application.completion_eligibility_status || 'pending',
    proposedEligibility: qualify ? 'eligible' : application.completion_eligibility_status || 'pending',
    preAttemptId: preOk ? preAttempt.id : null,
    taskSubmissionId: taskOk ? taskSubmission.id : null,
    postAttemptId: postOk ? postAttempt.id : null,
    attendedCountedSessions: Number(attendedCountedSessions) || 0,
    totalCountedSessions: Number(totalCountedSessions) || 0,
    attendancePercentageExact,
    attendancePercentageCanonical,
    hoursAlreadyAtOrAboveTarget: (hoursMod.toNullableInt(application.completed_training_hours) || 0) >= TARGET_HOURS,
    hoursWouldIncrease:
      proposedHours > (hoursMod.toNullableInt(application.completed_training_hours) || 0),
  };
}

function emptyCounters() {
  return {
    opportunitiesScanned: 0,
    enrollmentsScanned: 0,
    acceptedEnrollmentsScanned: 0,
    qualifying: 0,
    toUpdate: 0,
    alreadyEligibleWithHours: 0,
    hoursRaisedTo140: 0,
    hoursPreservedAbove140: 0,
    eligibilityOnly: 0,
    excluded: {
      enrollment_not_accepted: 0,
      expelled: 0,
      pre_assessment: 0,
      task_submission: 0,
      post_assessment: 0,
      attendance_below_80: 0,
      zero_counted_sessions: 0,
    },
    skippedFailed: [],
    integrityErrors: [],
    duplicateEnrollmentIds: [],
  };
}

async function loadSnapshot(prisma) {
  const opportunities = await prisma.field_training_opportunities.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      university_id: true,
      required_training_hours: true,
    },
  });

  const applications = await prisma.field_training_applications.findMany({
    select: {
      id: true,
      opportunity_id: true,
      student_id: true,
      status: true,
      training_status: true,
      expelled_at: true,
      completed_training_hours: true,
      completion_eligibility_status: true,
      hours_updated_at: true,
      hours_updated_by_id: true,
    },
  });

  const studentIds = [...new Set(applications.map((row) => row.student_id))];
  const students = studentIds.length
    ? await prisma.users.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, primary_university_id: true },
      })
    : [];

  const assessments = await prisma.field_training_assessments.findMany({
    select: { id: true, opportunity_id: true, type: true, title: true, description: true },
  });

  const attempts = await prisma.field_training_assessment_attempts.findMany({
    select: {
      id: true,
      assessment_id: true,
      application_id: true,
      student_id: true,
      submitted_at: true,
    },
  });

  const tasks = await prisma.field_training_tasks.findMany({
    select: { id: true, opportunity_id: true },
  });

  const submissions = await prisma.field_training_task_submissions.findMany({
    select: {
      id: true,
      task_id: true,
      application_id: true,
      student_id: true,
      review_status: true,
    },
  });

  const sessions = await prisma.field_training_sessions.findMany({
    where: { is_required: true },
    select: { id: true, opportunity_id: true, is_required: true },
  });

  const attendance = await prisma.field_training_attendance.findMany({
    select: {
      id: true,
      session_id: true,
      application_id: true,
      student_id: true,
      status: true,
    },
  });

  return {
    opportunities,
    applications,
    students,
    assessments,
    attempts,
    tasks,
    submissions,
    sessions,
    attendance,
  };
}

function indexSnapshot(snapshot) {
  const oppById = new Map(snapshot.opportunities.map((o) => [o.id, o]));
  const studentById = new Map((snapshot.students || []).map((s) => [s.id, s]));
  const assessmentsByOppType = new Map();
  for (const a of snapshot.assessments) {
    assessmentsByOppType.set(`${a.opportunity_id}:${a.type}`, a);
  }

  const attemptByAppAssessment = new Map();
  const crossOpportunityAttempts = [];
  const assessmentById = new Map(snapshot.assessments.map((a) => [a.id, a]));
  for (const attempt of snapshot.attempts) {
    const assessment = assessmentById.get(attempt.assessment_id);
    if (!assessment) {
      crossOpportunityAttempts.push({ attemptId: attempt.id, reason: 'assessment_missing' });
      continue;
    }
    attemptByAppAssessment.set(`${attempt.application_id}:${assessment.type}`, {
      ...attempt,
      opportunity_id: assessment.opportunity_id,
    });
  }

  const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));
  const submissionsByApp = new Map();
  for (const sub of snapshot.submissions) {
    const task = taskById.get(sub.task_id);
    const enriched = {
      ...sub,
      opportunity_id: task?.opportunity_id || null,
    };
    if (!submissionsByApp.has(sub.application_id)) submissionsByApp.set(sub.application_id, []);
    submissionsByApp.get(sub.application_id).push(enriched);
  }

  const sessionsByOpp = new Map();
  const sessionOpp = new Map();
  for (const session of snapshot.sessions) {
    sessionOpp.set(session.id, session.opportunity_id);
    if (!sessionsByOpp.has(session.opportunity_id)) sessionsByOpp.set(session.opportunity_id, []);
    sessionsByOpp.get(session.opportunity_id).push(session);
  }

  const attendanceByApp = new Map();
  for (const row of snapshot.attendance) {
    if (!attendanceByApp.has(row.application_id)) attendanceByApp.set(row.application_id, []);
    attendanceByApp.get(row.application_id).push(row);
  }

  return {
    oppById,
    studentById,
    assessmentsByOppType,
    attemptByAppAssessment,
    submissionsByApp,
    sessionsByOpp,
    sessionOpp,
    attendanceByApp,
    crossOpportunityAttempts,
  };
}

function pickValidTaskSubmission(application, submissions) {
  return (submissions || []).find((sub) => isValidTaskSubmission(sub, application)) || null;
}

function countAttendance(application, indexed) {
  const countedSessions = indexed.sessionsByOpp.get(application.opportunity_id) || [];
  const countedIds = new Set(countedSessions.map((s) => s.id));
  const rows = indexed.attendanceByApp.get(application.id) || [];
  let attended = 0;
  const seen = new Set();
  for (const row of rows) {
    if (!countedIds.has(row.session_id)) continue;
    if (row.student_id !== application.student_id) continue;
    const sessionOppId = indexed.sessionOpp.get(row.session_id);
    if (sessionOppId !== application.opportunity_id) continue;
    if (seen.has(row.session_id)) continue;
    seen.add(row.session_id);
    if (['present', 'late', 'excused'].includes(row.status)) attended += 1;
  }
  return { attended, counted: countedIds.size };
}

function detectDuplicateEnrollments(applications) {
  const seen = new Set();
  const duplicates = [];
  const pairSeen = new Set();
  for (const app of applications) {
    if (seen.has(app.id)) duplicates.push(app.id);
    seen.add(app.id);
    const pair = `${app.opportunity_id}:${app.student_id}`;
    if (pairSeen.has(pair)) duplicates.push(`${pair}::${app.id}`);
    pairSeen.add(pair);
  }
  return duplicates;
}

function buildDryRun(snapshot) {
  const indexed = indexSnapshot(snapshot);
  const counters = emptyCounters();
  counters.opportunitiesScanned = snapshot.opportunities.length;
  counters.duplicateEnrollmentIds = detectDuplicateEnrollments(snapshot.applications);
  if (indexed.crossOpportunityAttempts.length) {
    counters.integrityErrors.push(
      ...indexed.crossOpportunityAttempts.slice(0, 20).map((row) => ({
        type: 'cross_opportunity_attempt',
        ...row,
      }))
    );
  }

  const qualifying = [];
  const mutations = [];
  const excludedSamples = {
    pre_assessment: [],
    task_submission: [],
    post_assessment: [],
    attendance_below_80: [],
    zero_counted_sessions: [],
  };

  for (const application of snapshot.applications) {
    counters.enrollmentsScanned += 1;
    if (application.status === 'approved') counters.acceptedEnrollmentsScanned += 1;
    const opportunity = indexed.oppById.get(application.opportunity_id);
    if (!opportunity) {
      counters.integrityErrors.push({
        type: 'application_opportunity_missing',
        applicationId: application.id,
        opportunityId: application.opportunity_id,
      });
      counters.skippedFailed.push({
        applicationId: application.id,
        reason: 'opportunity_missing',
      });
      continue;
    }

    const preAssessment = indexed.assessmentsByOppType.get(`${opportunity.id}:pre`);
    const postAssessment = indexed.assessmentsByOppType.get(`${opportunity.id}:post`);
    const preAttempt = preAssessment
      ? indexed.attemptByAppAssessment.get(`${application.id}:pre`)
      : null;
    const postAttempt = postAssessment
      ? indexed.attemptByAppAssessment.get(`${application.id}:post`)
      : null;

    if (preAttempt && preAttempt.opportunity_id !== opportunity.id) {
      counters.integrityErrors.push({
        type: 'pre_attempt_cross_opportunity',
        applicationId: application.id,
        attemptId: preAttempt.id,
      });
    }
    if (postAttempt && postAttempt.opportunity_id !== opportunity.id) {
      counters.integrityErrors.push({
        type: 'post_attempt_cross_opportunity',
        applicationId: application.id,
        attemptId: postAttempt.id,
      });
    }
    if (preAttempt && preAttempt.student_id !== application.student_id) {
      counters.integrityErrors.push({
        type: 'pre_attempt_student_mismatch',
        applicationId: application.id,
        attemptId: preAttempt.id,
      });
    }
    if (postAttempt && postAttempt.student_id !== application.student_id) {
      counters.integrityErrors.push({
        type: 'post_attempt_student_mismatch',
        applicationId: application.id,
        attemptId: postAttempt.id,
      });
    }

    const taskSubmission = pickValidTaskSubmission(
      application,
      indexed.submissionsByApp.get(application.id)
    );
    const att = countAttendance(application, indexed);

    const evaluation = evaluateEnrollment({
      application,
      opportunity,
      preAttempt,
      postAttempt,
      taskSubmission,
      attendedCountedSessions: att.attended,
      totalCountedSessions: att.counted,
    });

    if (evaluation.integrityErrors.length) {
      counters.integrityErrors.push({
        applicationId: application.id,
        errors: evaluation.integrityErrors,
      });
    }

    if (evaluation.skipReasons.length) {
      for (const reason of evaluation.skipReasons) {
        counters.excluded[reason] = (counters.excluded[reason] || 0) + 1;
      }
      continue;
    }

    if (!evaluation.qualify) {
      for (const reason of evaluation.missing) {
        counters.excluded[reason] = (counters.excluded[reason] || 0) + 1;
        if (excludedSamples[reason] && excludedSamples[reason].length < 5) {
          excludedSamples[reason].push(application.id);
        }
      }
      continue;
    }

    counters.qualifying += 1;
    const row = {
      applicationId: application.id,
      studentId: application.student_id,
      opportunityId: opportunity.id,
      universityId:
        opportunity.university_id || indexed.studentById.get(application.student_id)?.primary_university_id || null,
      opportunityTitle: opportunity.title,
      trainingStatus: application.training_status,
      currentHours: evaluation.currentHours,
      proposedHours: evaluation.proposedHours,
      currentEligibility: evaluation.currentEligibility,
      proposedEligibility: evaluation.proposedEligibility,
      hoursWouldIncrease: evaluation.hoursWouldIncrease,
      hoursAlreadyAtOrAboveTarget: evaluation.hoursAlreadyAtOrAboveTarget,
      preAttemptId: evaluation.preAttemptId,
      taskSubmissionId: evaluation.taskSubmissionId,
      postAttemptId: evaluation.postAttemptId,
      attendedCountedSessions: evaluation.attendedCountedSessions,
      totalCountedSessions: evaluation.totalCountedSessions,
      attendancePercentageCanonical: evaluation.attendancePercentageCanonical,
      attendancePercentageExact: evaluation.attendancePercentageExact,
      mutate: evaluation.mutate,
    };
    qualifying.push(row);

    if (evaluation.hoursAlreadyAtOrAboveTarget) {
      counters.hoursPreservedAbove140 += 1;
    }
    if (!evaluation.mutate) {
      counters.alreadyEligibleWithHours += 1;
      continue;
    }

    counters.toUpdate += 1;
    if (evaluation.hoursWouldIncrease) counters.hoursRaisedTo140 += 1;
    if (!evaluation.hoursWouldIncrease && evaluation.currentEligibility !== 'eligible') {
      counters.eligibilityOnly += 1;
    }
    mutations.push(row);
  }

  return {
    operationId: OPERATION_ID,
    targetHours: TARGET_HOURS,
    minAttendancePercent: MIN_ATTENDANCE_PERCENT,
    counters,
    excludedSamples,
    qualifyingCount: qualifying.length,
    mutationCount: mutations.length,
    mutations,
    integrityErrorCount: counters.integrityErrors.length + counters.duplicateEnrollmentIds.length,
  };
}

async function applyMutations({ prisma, mutations, actorUserId, now = new Date() }) {
  const updated = [];
  const failed = [];
  for (const item of mutations) {
    try {
      const applied = await prisma.$transaction(
        async (tx) => {
          const current = await tx.field_training_applications.findUnique({
            where: { id: item.applicationId },
            select: {
              id: true,
              student_id: true,
              opportunity_id: true,
              completed_training_hours: true,
              completion_eligibility_status: true,
              training_status: true,
              expelled_at: true,
              status: true,
              hours_updated_by_id: true,
            },
          });
          if (!current || current.status !== 'approved' || current.expelled_at) {
            return { skip: 'row_changed_since_dry_run' };
          }
          const proposedHours = proposedCompletedHours(current.completed_training_hours);
          if (!needsMutation(current, proposedHours)) return { skip: 'already_applied' };

          const terminal = TERMINAL_TRAINING_STATUSES.includes(current.training_status);
          const data = {
            completed_training_hours: proposedHours,
            hours_updated_at: now,
            hours_updated_by_id: actorUserId || current.hours_updated_by_id || null,
            completion_eligibility_status: 'eligible',
            eligibility_reason: {
              reasons: [],
              details: {
                backfill: OPERATION_ID,
                attendance_percentage: item.attendancePercentageCanonical,
                attended_counted_sessions: item.attendedCountedSessions,
                total_counted_sessions: item.totalCountedSessions,
                pre_attempt_id: item.preAttemptId,
                task_submission_id: item.taskSubmissionId,
                post_attempt_id: item.postAttemptId,
              },
            },
            updated_at: now,
          };
          if (!terminal) data.training_status = 'eligible_for_completion';

          await tx.field_training_applications.update({
            where: { id: current.id },
            data,
          });
          return {
            row: {
              ...item,
              previousHours: hoursMod.toNullableInt(current.completed_training_hours) || 0,
              newHours: proposedHours,
              previousEligibility: current.completion_eligibility_status,
              newEligibility: 'eligible',
            },
          };
        },
        { timeout: 20000, maxWait: 10000 }
      );
      if (applied?.row) updated.push(applied.row);
      else if (applied?.skip && applied.skip !== 'already_applied') {
        failed.push({ applicationId: item.applicationId, reason: applied.skip });
      }
    } catch (err) {
      failed.push({
        applicationId: item.applicationId,
        reason: err.message || 'transaction_failed',
      });
    }
  }
  return { updated, failed };
}

async function writeAudits({ updated, actorUserId, executedAt }) {
  let auditCount = 0;
  for (const item of updated) {
    await recordAudit({
      userId: actorUserId || null,
      universityId: item.universityId || null,
      actionType: OPERATION_ID,
      entityType: 'field_training_application',
      entityId: item.applicationId,
      oldValues: {
        operation_id: OPERATION_ID,
        completed_training_hours: item.previousHours,
        completion_eligibility_status: item.previousEligibility,
      },
      newValues: {
        operation_id: OPERATION_ID,
        student_id: item.studentId,
        enrollment_id: item.applicationId,
        opportunity_id: item.opportunityId,
        university_id: item.universityId,
        previous_completed_hours: item.previousHours,
        new_completed_hours: item.newHours,
        previous_eligibility_status: item.previousEligibility,
        new_eligibility_status: item.newEligibility,
        pre_assessment_attempt_id: item.preAttemptId,
        counted_task_submission_id: item.taskSubmissionId,
        post_assessment_attempt_id: item.postAttemptId,
        attendance_numerator: item.attendedCountedSessions,
        attendance_denominator: item.totalCountedSessions,
        attendance_percentage: item.attendancePercentageCanonical,
        attendance_percentage_exact: item.attendancePercentageExact,
        acting_admin_user_id: actorUserId || null,
        executed_at: executedAt.toISOString(),
      },
    });
    auditCount += 1;
  }
  return auditCount;
}

async function resolveActorUserId(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function runHoursEligibilityBackfill({
  apply = false,
  prisma = defaultPrisma,
  actorUserId = null,
} = {}) {
  const snapshot = await loadSnapshot(prisma);
  const dryRun = buildDryRun(snapshot);
  const executedAt = new Date();

  if (dryRun.integrityErrorCount > 0) {
    return {
      apply: false,
      blocked: true,
      reason: 'integrity_errors',
      dryRun,
      updatedCount: 0,
      auditCount: 0,
      failed: [],
    };
  }

  if (!apply) {
    return {
      apply: false,
      blocked: false,
      dryRun,
      updatedCount: 0,
      auditCount: 0,
      failed: [],
    };
  }

  const actor = actorUserId || (await resolveActorUserId(prisma));
  const { updated, failed } = await applyMutations({
    prisma,
    mutations: dryRun.mutations,
    actorUserId: actor,
    now: executedAt,
  });
  const auditCount = await writeAudits({ updated, actorUserId: actor, executedAt });

  return {
    apply: true,
    blocked: false,
    dryRun,
    updatedCount: updated.length,
    auditCount,
    failed,
    actorUserId: actor,
    executedAt: executedAt.toISOString(),
    updatedSample: updated.slice(0, 10).map((row) => ({
      applicationId: row.applicationId,
      previousHours: row.previousHours,
      newHours: row.newHours,
      previousEligibility: row.previousEligibility,
      newEligibility: row.newEligibility,
    })),
  };
}

module.exports = {
  OPERATION_ID,
  TARGET_HOURS,
  MIN_ATTENDANCE_PERCENT,
  VALID_TASK_REVIEW_STATUSES,
  isValidSubmittedAttempt,
  isValidTaskSubmission,
  qualifiesAttendance,
  exactAttendancePercent,
  canonicalAttendancePercent,
  proposedCompletedHours,
  needsMutation,
  evaluateEnrollment,
  buildDryRun,
  runHoursEligibilityBackfill,
  formatCompletedHoursLabelAr: hoursMod.formatCompletedHoursLabelAr,
};
