'use strict';

/**
 * Authoritative CURRENT OFFICIAL Field Training result resolver (P0 + P1).
 *
 * Path:
 *   application -> resolveFieldTrainingPolicy -> overlay or live engine -> officialResult
 *
 * Consumers never choose policy themselves.
 */

const { prisma } = require('../../config/db');
const { ACCEPTED_TASK_STATUSES } = require('./fieldTrainingEvaluation.constants');
const {
  resolveFieldTrainingPolicy,
  validateOfficialResultIntegrity,
  logPolicyResolution,
  getApprovedOverlay: getApprovedOverlayFromPolicy,
} = require('./fieldTraining.policy.service');

const RESULT_SOURCE = Object.freeze({
  APPROVED_EVALUATION_RESULT: 'APPROVED_EVALUATION_RESULT',
  CURRENT_QUALIFICATION: 'CURRENT_QUALIFICATION',
  LEGACY_QUALIFICATION: 'LEGACY_QUALIFICATION',
});

const DISQUALIFYING_TRAINING_STATUSES = Object.freeze(['expelled', 'failed']);

function num(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round1(value) {
  const n = num(value);
  if (n == null) return null;
  return Math.round(n * 10) / 10;
}

function canonicalizeEligibility(value) {
  if (value == null || value === '') return 'PENDING';
  const key = String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (key === 'ELIGIBLE') return 'ELIGIBLE';
  if (key === 'NOT_ELIGIBLE' || key === 'INELIGIBLE') return 'NOT_ELIGIBLE';
  if (key === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  if (key === 'PENDING') return 'PENDING';
  if (key === 'INCOMPLETE') return 'NEEDS_REVIEW';
  return 'PENDING';
}

function eligibilityToDb(canon) {
  if (canon === 'ELIGIBLE') return 'eligible';
  if (canon === 'NOT_ELIGIBLE') return 'ineligible';
  if (canon === 'NEEDS_REVIEW') return 'needs_review';
  return 'pending';
}

function isOfficiallyEligible(official) {
  return official?.eligibility === 'ELIGIBLE';
}

function isDisqualifyingTrainingStatus(app) {
  if (!app) return false;
  if (app.training_status === 'failed') return true;
  if (app.training_status === 'expelled') return true;
  if (app.expelled_at) return true;
  return false;
}

function getApprovedOverlay(app) {
  return getApprovedOverlayFromPolicy(app);
}

function officialEligibilityFromApplication(app) {
  const approved = getApprovedOverlay(app);
  if (approved?.approvedStatus) return canonicalizeEligibility(approved.approvedStatus);
  return canonicalizeEligibility(app?.completion_eligibility_status);
}

function sourceLabelAr(source) {
  const present = require('../../utils/fieldTraining.reportPresentation');
  return present.labelSourceHuman(source);
}

function breakdownFromComponents(components = {}, fallback = null) {
  if (fallback && typeof fallback === 'object') {
    return {
      attendancePoints: round1(fallback.attendancePoints),
      postAssessmentPoints: round1(fallback.postAssessmentPoints),
      taskPoints: round1(fallback.taskPoints),
      behaviorPoints: round1(fallback.behaviorPoints),
    };
  }
  return {
    attendancePoints: round1(components.attendance?.points),
    postAssessmentPoints: round1(components.postAssessment?.points),
    taskPoints: round1(components.tasks?.points),
    behaviorPoints: round1(components.behavior?.points),
  };
}

function overlayComponentPoints(components, official) {
  const next = components && typeof components === 'object' ? { ...components } : {};
  const att = next.attendance && typeof next.attendance === 'object' ? { ...next.attendance } : {};
  const post =
    next.postAssessment && typeof next.postAssessment === 'object' ? { ...next.postAssessment } : {};
  const tasks = next.tasks && typeof next.tasks === 'object' ? { ...next.tasks } : {};
  const behavior = next.behavior && typeof next.behavior === 'object' ? { ...next.behavior } : {};
  if (official.attendancePoints != null) att.points = official.attendancePoints;
  if (official.postPoints != null) post.points = official.postPoints;
  if (official.taskPoints != null) {
    tasks.points = official.taskPoints;
    tasks.approvedPoints = official.taskPoints;
  }
  if (official.submittedTaskCount != null) tasks.submittedCount = official.submittedTaskCount;
  if (official.requiredTaskCount != null) tasks.requiredCount = official.requiredTaskCount;
  if (official.behaviorPoints != null) behavior.points = official.behaviorPoints;
  return {
    ...next,
    attendance: att,
    postAssessment: post,
    tasks,
    behavior,
    finalScore: official.finalScore ?? next.finalScore ?? null,
  };
}

/**
 * Count real LMS submissions for required tasks. Never infers from Excel/overlay text.
 */
async function loadLmsTaskSubmissionCounts(opportunityId, applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  const requiredTasks = opportunityId
    ? await prisma.field_training_tasks.findMany({
        where: { opportunity_id: opportunityId, NOT: { is_required: false } },
        select: { id: true },
      })
    : [];
  const requiredCount = requiredTasks.length;
  const requiredIds = requiredTasks.map((t) => t.id);
  const counts = Object.fromEntries(
    ids.map((id) => [id, { submitted: 0, graded: 0, required: requiredCount }])
  );
  if (!ids.length || !requiredIds.length) return counts;

  const subs = await prisma.field_training_task_submissions.findMany({
    where: {
      application_id: { in: ids },
      task_id: { in: requiredIds },
    },
    select: { application_id: true, review_status: true },
  });
  for (const s of subs) {
    const row = counts[s.application_id];
    if (!row) continue;
    row.submitted += 1;
    if (ACCEPTED_TASK_STATUSES.includes(String(s.review_status))) row.graded += 1;
  }
  return counts;
}

function passingScoreOf(details, liveCalculated, policy) {
  return num(
    policy?.qualificationThreshold,
    num(details?.passingScore, num(liveCalculated?.policy?.minimumPassingScore, 80))
  );
}

/**
 * Pure mapper used by the resolver and unit tests. Does not hit the database.
 */
function buildOfficialResult({
  app,
  opportunity = null,
  taskCounts = null,
  liveCalculated = null,
  livePublic = null,
  policy: policyHint = null,
  logResolution = false,
} = {}) {
  if (!app) return null;
  const policy = policyHint || resolveFieldTrainingPolicy({
    application: app,
    opportunity,
    universityPolicy: liveCalculated?.policy || null,
  });
  const details = app.eligibility_reason?.details && typeof app.eligibility_reason.details === 'object'
    ? app.eligibility_reason.details
    : {};
  const approved = getApprovedOverlay(app);
  const liveComponents = liveCalculated?.scoreComponents || livePublic?.scoreComponents || {};
  const storedComponents = details.scoreComponents || {};
  const passingScore = passingScoreOf(details, liveCalculated, policy);

  let eligibility;
  let finalScore;
  let breakdown;
  let resultSource;
  let source;
  let sourceLabel;
  let approvedAt = null;
  let reasons = [];
  let reasonCodes = [];
  let scorePassed = null;
  let calculatedFinalScore = details.calculatedFinalScore ?? null;

  if (approved) {
    resultSource = approved.source || RESULT_SOURCE.APPROVED_EVALUATION_RESULT;
    source = approved.source || RESULT_SOURCE.APPROVED_EVALUATION_RESULT;
    sourceLabel = approved.sourceLabelAr || sourceLabelAr(source);
    eligibility = canonicalizeEligibility(approved.approvedStatus || app.completion_eligibility_status);
    finalScore = round1(approved.approvedFinalScore ?? details.displayFinalScore ?? details.finalScore);
    breakdown = breakdownFromComponents(storedComponents, approved.scoreBreakdown || details.scoreBreakdown);
    approvedAt = approved.approvedAt || null;
    reasons = Array.isArray(app.eligibility_reason?.labelsAr)
      ? app.eligibility_reason.labelsAr.filter(Boolean)
      : [];
    reasonCodes = Array.isArray(app.eligibility_reason?.reasons) ? app.eligibility_reason.reasons : [];
    calculatedFinalScore =
      details.calculatedFinalScore ?? round1(liveCalculated?.finalScore) ?? calculatedFinalScore;
    if (finalScore != null) scorePassed = Number(finalScore) >= passingScore;
    else if (eligibility === 'ELIGIBLE') scorePassed = true;
    else scorePassed = false;
  } else if (liveCalculated) {
    const policyCode = liveCalculated.policy?.scoringRules?.code || livePublic?.policyCode || null;
    resultSource = RESULT_SOURCE.CURRENT_QUALIFICATION;
    source = policyCode || resultSource;
    sourceLabel = sourceLabelAr(source) || 'النتيجة الحالية المعتمدة';
    eligibility = canonicalizeEligibility(
      liveCalculated.eligibilityStatus || liveCalculated.workflowOutcome || app.completion_eligibility_status
    );
    finalScore = round1(liveCalculated.finalScore);
    breakdown = breakdownFromComponents(liveComponents, details.scoreBreakdown);
    reasons = Array.isArray(liveCalculated.eligibilityReasonLabels)
      ? liveCalculated.eligibilityReasonLabels.filter(Boolean)
      : Array.isArray(app.eligibility_reason?.labelsAr)
        ? app.eligibility_reason.labelsAr.filter(Boolean)
        : [];
    reasonCodes = Array.isArray(liveCalculated.eligibilityReasons)
      ? liveCalculated.eligibilityReasons
      : [];
    calculatedFinalScore = round1(liveCalculated.finalScore);
    scorePassed =
      liveCalculated.scorePassed != null
        ? Boolean(liveCalculated.scorePassed)
        : finalScore != null
          ? Number(finalScore) >= passingScore
          : null;
  } else {
    resultSource = RESULT_SOURCE.CURRENT_QUALIFICATION;
    source = details.policyCode || resultSource;
    sourceLabel = sourceLabelAr(source) || 'النتيجة الحالية المعتمدة';
    eligibility = canonicalizeEligibility(app.completion_eligibility_status);
    finalScore = round1(details.displayFinalScore ?? details.finalScore);
    breakdown = breakdownFromComponents(storedComponents, details.scoreBreakdown);
    reasons = Array.isArray(app.eligibility_reason?.labelsAr)
      ? app.eligibility_reason.labelsAr.filter(Boolean)
      : [];
    reasonCodes = Array.isArray(app.eligibility_reason?.reasons) ? app.eligibility_reason.reasons : [];
    if (details.scorePassed != null) scorePassed = Boolean(details.scorePassed);
    else if (finalScore != null) scorePassed = Number(finalScore) >= passingScore;
  }

  const tasks = taskCounts || {
    submitted: storedComponents.tasks?.submittedCount ?? liveComponents.tasks?.submittedCount ?? null,
    graded: storedComponents.tasks?.acceptedCount ?? liveComponents.tasks?.acceptedCount ?? null,
    required:
      storedComponents.tasks?.requiredCount ??
      liveComponents.tasks?.requiredCount ??
      null,
  };

  const attendancePercentage = round1(
    app.attendance_percentage ??
      details.attendance_percentage ??
      liveCalculated?.attendancePercent ??
      liveComponents.attendance?.rawPercentage
  );
  const postAssessmentScore = round1(
    app.post_assessment_score ?? details.post_assessment_score ?? liveCalculated?.postAssessmentScore
  );
  const completedTrainingHours = num(
    app.completed_training_hours,
    num(details.training_hours?.completed_hours, num(liveCalculated?.completedHours))
  );
  const requiredTrainingHours = num(
    opportunity?.required_training_hours,
    num(details.training_hours?.required_hours, num(liveCalculated?.policy?.requiredTrainingHours))
  );

  const eligibilityDb = eligibilityToDb(eligibility);
  const scoreComponents = overlayComponentPoints(
    livePublic?.scoreComponents || storedComponents,
    {
      attendancePoints: breakdown.attendancePoints,
      postPoints: breakdown.postAssessmentPoints,
      taskPoints: breakdown.taskPoints,
      behaviorPoints: breakdown.behaviorPoints,
      submittedTaskCount: tasks.submitted,
      requiredTaskCount: tasks.required,
      finalScore,
    }
  );

  if (eligibility === 'ELIGIBLE') {
    reasons = (reasons || []).filter(
      (label) => !/أقل من حد التأهيل|العلامة النهائية أقل من|غير مؤهل/.test(String(label || ''))
    );
    reasonCodes = (reasonCodes || []).filter(
      (code) =>
        String(code) !== 'FINAL_SCORE_BELOW_MINIMUM' &&
        String(code) !== 'AUTHORIZED_ADMIN_ELIGIBILITY_DECISION'
    );
  }

  const integrity = validateOfficialResultIntegrity({
    eligibility,
    trainingStatus: app.training_status,
    finalScore,
    qualificationThreshold: passingScore,
    attendancePoints: breakdown.attendancePoints,
    postPoints: breakdown.postAssessmentPoints,
    taskPoints: breakdown.taskPoints,
    behaviorPoints: breakdown.behaviorPoints,
    isHistoricalApprovedResult: policy.isHistoricalApprovedResult,
    isManualOverride: policy.isManualOverride,
    scoringCaps: policy.scoringCaps,
    expelledAt: app.expelled_at,
  });

  if (logResolution) {
    logPolicyResolution(policy, {
      resultSource,
      manualOverrideApplied: policy.isManualOverride,
      historicalApprovedResultApplied: policy.isHistoricalApprovedResult,
    });
  }

  return {
    applicationId: app.id,
    studentId: app.student_id,
    opportunityId: app.opportunity_id,
    eligibility,
    eligibilityDb,
    finalScore,
    attendancePercentage,
    attendancePoints: breakdown.attendancePoints,
    postAssessmentScore,
    postPoints: breakdown.postAssessmentPoints,
    taskPoints: breakdown.taskPoints,
    behaviorPoints: breakdown.behaviorPoints,
    completedTrainingHours,
    requiredTrainingHours,
    submittedTaskCount: tasks.submitted,
    requiredTaskCount: tasks.required,
    gradedTaskCount: tasks.graded ?? null,
    hours: completedTrainingHours,
    reasons,
    reasonCodes,
    resultSource,
    approvedAt,
    trainingStatus: app.training_status || null,
    scoreBreakdown: breakdown,
    scorePassed,
    passingScore,
    qualificationThreshold: passingScore,
    scoreComponents,
    approvedEvaluationResult: approved,
    calculatedFinalScore,
    calculatedResult: {
      finalScore: round1(liveCalculated?.finalScore ?? calculatedFinalScore),
      eligibility: liveCalculated
        ? canonicalizeEligibility(liveCalculated.eligibilityStatus || liveCalculated.workflowOutcome)
        : null,
    },
    policy: policy.family,
    policyVersion: policy.policyVersion,
    isHistoricalApprovedResult: policy.isHistoricalApprovedResult,
    isManualOverride: policy.isManualOverride,
    integrity,
    // Backward-compatible aliases used by existing Tafila report/export callers.
    approvedStatus: eligibility,
    approvedEligibility: eligibility,
    approvedFinalScore: finalScore,
    approvedAttendancePoints: breakdown.attendancePoints,
    approvedPostPoints: breakdown.postAssessmentPoints,
    approvedTaskPoints: breakdown.taskPoints,
    approvedBehaviorPoints: breakdown.behaviorPoints,
    approvedReasons: reasons,
    approvedSource: source,
    source,
    sourceLabelAr: sourceLabel,
    reviewedAt: approvedAt,
    previousExcelScore: approved?.previousExcelScore ?? null,
    recalculatedScore: round1(approved?.recalculatedScore ?? calculatedFinalScore),
    changeReasonAr: approved?.changeReasonAr || null,
    workflowStatus: eligibilityDb,
    rawTaskData: approved?.rawTaskData || null,
    approvedTaskEvaluation: approved?.approvedTaskEvaluation || null,
    disqualifyingTrainingStatus: isDisqualifyingTrainingStatus(app),
  };
}

function toOfficialSnapshot(official) {
  if (!official) return null;
  return {
    applicationId: official.applicationId,
    studentId: official.studentId,
    opportunityId: official.opportunityId,
    eligibility: official.eligibility,
    finalScore: official.finalScore,
    attendancePercentage: official.attendancePercentage,
    attendancePoints: official.attendancePoints,
    postAssessmentScore: official.postAssessmentScore,
    postPoints: official.postPoints,
    taskPoints: official.taskPoints,
    behaviorPoints: official.behaviorPoints,
    completedTrainingHours: official.completedTrainingHours,
    requiredTrainingHours: official.requiredTrainingHours,
    submittedTaskCount: official.submittedTaskCount,
    requiredTaskCount: official.requiredTaskCount,
    reasons: official.reasons || [],
    resultSource: official.resultSource,
    approvedAt: official.approvedAt,
    policy: official.policy || null,
    isHistoricalApprovedResult: Boolean(official.isHistoricalApprovedResult),
    isManualOverride: Boolean(official.isManualOverride),
  };
}

function officialSnapshotsEqual(a, b) {
  const left = toOfficialSnapshot(a);
  const right = toOfficialSnapshot(b);
  if (!left || !right) return false;
  const keys = Object.keys(left);
  return keys.every((key) => {
    if (key === 'reasons') {
      return JSON.stringify(left.reasons || []) === JSON.stringify(right.reasons || []);
    }
    const lv = left[key];
    const rv = right[key];
    if (lv == null && rv == null) return true;
    if (typeof lv === 'number' || typeof rv === 'number') {
      if (lv == null || rv == null) return false;
      return Math.abs(Number(lv) - Number(rv)) <= 0.05;
    }
    return lv === rv;
  });
}

function toPublicQualificationFromOfficial(official, livePublic = null) {
  if (!official) return livePublic || null;
  const base = livePublic && typeof livePublic === 'object' ? { ...livePublic } : {};
  return {
    ...base,
    finalScore: official.finalScore,
    approvedFinalScore: official.finalScore,
    eligibilityStatus: official.eligibility,
    workflowOutcome: official.eligibilityDb,
    scorePassed: official.scorePassed,
    scoreStatus:
      official.finalScore == null ? base.scoreStatus || 'INCOMPLETE' : base.scoreStatus || 'COMPLETE',
    eligibilityReasonLabels: official.reasons,
    eligibilityReasons: official.reasonCodes?.length ? official.reasonCodes : base.eligibilityReasons || [],
    scoreBreakdown: official.scoreBreakdown,
    scoreComponents: overlayComponentPoints(base.scoreComponents || official.scoreComponents, official),
    approvedEvaluationResult: official.approvedEvaluationResult || null,
    approvedStatus: official.eligibility,
    approvedSource: official.source,
    approvedSourceLabelAr: official.sourceLabelAr,
    submittedRequiredTaskCount: official.submittedTaskCount,
    calculatedFinalScore: official.calculatedFinalScore,
    policy: official.policy,
    policyVersion: official.policyVersion,
    resultSource: official.resultSource,
    isHistoricalApprovedResult: official.isHistoricalApprovedResult,
    isManualOverride: official.isManualOverride,
    qualificationThreshold: official.qualificationThreshold ?? official.passingScore,
    passingScore: official.passingScore ?? base.passingScore ?? 80,
  };
}

function applicationSelectForOfficialResult() {
  return {
    id: true,
    student_id: true,
    opportunity_id: true,
    completion_eligibility_status: true,
    eligibility_reason: true,
    attendance_percentage: true,
    completed_training_hours: true,
    post_assessment_score: true,
    pre_assessment_score: true,
    training_status: true,
    expelled_at: true,
    completion_letter_issued_at: true,
  };
}

async function loadApplicationsForOfficial(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return [];
  return prisma.field_training_applications.findMany({
    where: { id: { in: ids } },
    select: applicationSelectForOfficialResult(),
  });
}

async function loadOpportunitiesForOfficial(opportunityIds) {
  const ids = [...new Set((opportunityIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.field_training_opportunities.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      required_training_hours: true,
      minimum_attendance_percentage: true,
      completion_rules: true,
      university_id: true,
    },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadLiveByApplicationIds(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const qualificationService = require('./fieldTraining.qualification.service');
  const rows = await qualificationService.calculateForApplications(ids);
  return new Map(rows.map((row) => [row.applicationId, row]));
}

/**
 * Authoritative official result for one application.
 * Overlay-backed (historical/manual approved) results are never live-recalculated.
 */
async function resolveFieldTrainingApprovedResult(applicationId, options = {}) {
  if (!applicationId) return null;
  const [row] = await resolveFieldTrainingApprovedResults([applicationId], {
    ...options,
    logResolution: options.logResolution !== false,
  });
  return row || null;
}

async function resolveFieldTrainingApprovedResults(applicationIds, options = {}) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return [];

  let apps = options.applications || [];
  if (!apps.length && options.application) apps = [options.application];
  if (!apps.length) {
    apps = await loadApplicationsForOfficial(ids);
  } else {
    const byId = new Map(apps.map((app) => [app.id, app]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) {
      const extra = await loadApplicationsForOfficial(missing);
      extra.forEach((app) => byId.set(app.id, app));
      apps = ids.map((id) => byId.get(id)).filter(Boolean);
    } else {
      apps = ids.map((id) => byId.get(id)).filter(Boolean);
    }
  }

  const appById = new Map(apps.map((app) => [app.id, app]));
  const oppById =
    options.opportunities instanceof Map
      ? options.opportunities
      : await loadOpportunitiesForOfficial(apps.map((app) => app.opportunity_id));

  const byOpportunity = new Map();
  for (const app of apps) {
    const list = byOpportunity.get(app.opportunity_id) || [];
    list.push(app);
    byOpportunity.set(app.opportunity_id, list);
  }

  const taskCountsByApp = {};
  await Promise.all(
    [...byOpportunity.entries()].map(async ([opportunityId, oppApps]) => {
      const counts = await loadLmsTaskSubmissionCounts(
        opportunityId,
        oppApps.map((app) => app.id)
      );
      Object.assign(taskCountsByApp, counts);
    })
  );

  const needsLive = [];
  for (const app of apps) {
    if (getApprovedOverlay(app)) continue;
    if (options.liveById?.has(app.id)) continue;
    if (options.skipLive) continue;
    needsLive.push(app.id);
  }
  const liveById = options.liveById instanceof Map ? new Map(options.liveById) : new Map();
  if (needsLive.length) {
    const loaded = await loadLiveByApplicationIds(needsLive);
    loaded.forEach((value, key) => liveById.set(key, value));
  }

  return ids.map((id) => {
    const app = appById.get(id);
    if (!app) return null;
    const liveRow = liveById.get(id);
    return buildOfficialResult({
      app,
      opportunity: oppById.get(app.opportunity_id) || options.opportunity || null,
      taskCounts: taskCountsByApp[app.id] || { submitted: 0, graded: 0, required: 0 },
      liveCalculated: liveRow?.calculated || null,
      livePublic: liveRow?.public || null,
      logResolution: Boolean(options.logResolution) && ids.length === 1,
    });
  });
}

module.exports = {
  RESULT_SOURCE,
  DISQUALIFYING_TRAINING_STATUSES,
  num,
  round1,
  canonicalizeEligibility,
  eligibilityToDb,
  isOfficiallyEligible,
  isDisqualifyingTrainingStatus,
  getApprovedOverlay,
  officialEligibilityFromApplication,
  sourceLabelAr,
  loadLmsTaskSubmissionCounts,
  buildOfficialResult,
  toOfficialSnapshot,
  officialSnapshotsEqual,
  toPublicQualificationFromOfficial,
  resolveFieldTrainingApprovedResult,
  resolveFieldTrainingApprovedResults,
  applicationSelectForOfficialResult,
};
