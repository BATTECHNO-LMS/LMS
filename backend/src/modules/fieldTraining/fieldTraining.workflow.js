const { prisma } = require('../../config/db');

/** Statuses where student may access tasks, sessions, assessments (not expelled). */
const ACTIVE_TRAINING_STATUSES = new Set([
  'pre_assessment_completed',
  'ready_for_training',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
]);

const POST_TRAINING_STATUSES = new Set([
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
]);

function isExpelled(app) {
  return app?.training_status === 'expelled' || Boolean(app?.expelled_at);
}

function canAccessTrainingContent(app) {
  if (!app || app.status !== 'approved' || isExpelled(app)) return false;
  return ACTIVE_TRAINING_STATUSES.has(app.training_status);
}

function canTakePreAssessment(app, opp) {
  if (!app || app.status !== 'approved' || isExpelled(app)) return false;
  if (!opp?.requires_pre_assessment) return false;
  return app.training_status === 'pre_assessment_pending';
}

function canTakePostAssessment(app, opp) {
  if (!app || app.status !== 'approved' || isExpelled(app)) return false;
  if (!opp?.requires_post_assessment) return false;
  return POST_TRAINING_STATUSES.has(app.training_status);
}

function scoreToLevel(score, maxScore) {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  const pct = (Number(score) / Number(maxScore)) * 100;
  if (pct < 50) return 'beginner';
  if (pct < 75) return 'intermediate';
  return 'advanced';
}

/**
 * present + late + excused = attended; denominator = required sessions only.
 */
async function calculateAttendancePercentage(applicationId) {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    select: { opportunity_id: true },
  });
  if (!app) return null;

  const requiredSessions = await prisma.field_training_sessions.findMany({
    where: { opportunity_id: app.opportunity_id, is_required: true },
    select: { id: true },
  });
  if (!requiredSessions.length) return null;

  const sessionIds = requiredSessions.map((s) => s.id);
  const records = await prisma.field_training_attendance.findMany({
    where: { application_id: applicationId, session_id: { in: sessionIds } },
    select: { status: true },
  });

  const attended = records.filter((r) =>
    ['present', 'late', 'excused'].includes(r.status)
  ).length;
  const pct = Math.round((attended / requiredSessions.length) * 10000) / 100;
  return pct;
}

async function refreshAttendancePercentage(applicationId) {
  const pct = await calculateAttendancePercentage(applicationId);
  if (pct == null) return null;
  await prisma.field_training_applications.update({
    where: { id: applicationId },
    data: { attendance_percentage: pct },
  });
  return pct;
}

function resolveTrainingStatusOnApproval(opp) {
  if (opp.requires_pre_assessment) {
    return { training_status: 'pre_assessment_pending' };
  }
  if (opp.status === 'in_progress') {
    return { training_status: 'in_training', training_started_at: new Date() };
  }
  return { training_status: 'ready_for_training' };
}

/**
 * @returns {{ outcome: 'eligible'|'ineligible'|'needs_review', reasons: string[], details: Record<string, unknown> }}
 */
async function calculateFieldTrainingEligibility(applicationId) {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    include: {
      field_training_opportunities: true,
      field_training_task_submissions: {
        include: { field_training_tasks: { select: { is_final_task: true } } },
      },
    },
  });
  if (!app) {
    return { outcome: 'ineligible', reasons: ['application_not_found'], details: {} };
  }
  const opp = app.field_training_opportunities;
  const reasons = [];
  const details = {};

  if (isExpelled(app)) {
    return { outcome: 'ineligible', reasons: ['expelled'], details: {} };
  }
  if (app.training_status === 'failed') {
    return { outcome: 'ineligible', reasons: ['failed'], details: {} };
  }

  if (opp.minimum_attendance_percentage != null) {
    const pct =
      app.attendance_percentage != null
        ? Number(app.attendance_percentage)
        : await calculateAttendancePercentage(applicationId);
    details.attendance_percentage = pct;
    if (pct == null || pct < opp.minimum_attendance_percentage) {
      reasons.push('attendance_below_minimum');
    }
  }

  if (opp.requires_post_assessment) {
    details.post_assessment_score =
      app.post_assessment_score != null ? Number(app.post_assessment_score) : null;
    if (app.post_assessment_score == null) {
      reasons.push('post_assessment_missing');
    } else if (
      opp.minimum_post_assessment_score != null &&
      Number(app.post_assessment_score) < Number(opp.minimum_post_assessment_score)
    ) {
      reasons.push('post_assessment_below_minimum');
    }
  }

  if (opp.requires_final_task) {
    const finalSub = app.field_training_task_submissions.find(
      (s) => s.field_training_tasks?.is_final_task
    );
    details.final_task_status = app.final_task_status;
    if (!finalSub) {
      reasons.push('final_task_not_submitted');
    } else if (finalSub.review_status === 'rejected') {
      reasons.push('final_task_rejected');
    } else if (finalSub.review_status === 'pending' || finalSub.review_status === 'needs_revision') {
      reasons.push('final_task_pending_review');
    }
  }

  const manualReview = Boolean(opp.completion_rules?.manual_review_required);
  if (reasons.some((r) => r.endsWith('_pending_review'))) {
    return { outcome: 'needs_review', reasons, details };
  }
  if (reasons.length) {
    return { outcome: 'ineligible', reasons, details };
  }
  if (manualReview) {
    return { outcome: 'needs_review', reasons: [], details };
  }
  return { outcome: 'eligible', reasons: [], details };
}

async function persistEligibility(applicationId) {
  const result = await calculateFieldTrainingEligibility(applicationId);
  const statusMap = {
    eligible: 'eligible',
    ineligible: 'ineligible',
    needs_review: 'needs_review',
  };
  await prisma.field_training_applications.update({
    where: { id: applicationId },
    data: {
      completion_eligibility_status: statusMap[result.outcome],
      eligibility_reason: { reasons: result.reasons, details: result.details },
      ...(result.outcome === 'eligible' ? { training_status: 'eligible_for_completion' } : {}),
    },
  });
  return result;
}

module.exports = {
  ACTIVE_TRAINING_STATUSES,
  POST_TRAINING_STATUSES,
  isExpelled,
  canAccessTrainingContent,
  canTakePreAssessment,
  canTakePostAssessment,
  scoreToLevel,
  calculateAttendancePercentage,
  refreshAttendancePercentage,
  resolveTrainingStatusOnApproval,
  calculateFieldTrainingEligibility,
  persistEligibility,
};
