'use strict';

/**
 * Central Field Training scoring / eligibility policy selector (P1).
 *
 * Consumers must not choose a scoring family themselves. Official UI, reports,
 * Excel, bulk recalculation, and completion-letter gates all call
 * `resolveFieldTrainingPolicy` (directly or via the P0 official result resolver).
 *
 * Precedence (matches current production semantics, made explicit):
 *   1. Explicit valid administrative override (approved overlay + FORCE_NOT_ELIGIBLE)
 *   2. Approved historical cohort result (`approvedEvaluationResult` overlay)
 *   3. Opportunity-specific `completion_rules.scoringPolicy`
 *   4. University evaluation-policy scoring model
 *   5. Legacy weighted engine only when historical data / unstamped opportunities require it
 *
 * Historical exception: primary Tafila online opportunity id is isolated here.
 * Do not scatter `if (opportunityId === tafilaId)` in unrelated services.
 */

const { log } = require('../../utils/logger');
const {
  DEFAULT_POLICY,
  SCORING_MODEL,
  TASKS_SCORING_MODE,
} = require('./fieldTrainingEvaluation.constants');
const { resolveEligibilityOverride } = require('./fieldTraining.eligibilityOverrides');
const {
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  isPrimaryTafilaOpportunity,
} = require('./fieldTraining.tafilaApprovedBaseline');

const POLICY_FAMILY = Object.freeze({
  MANUAL_APPROVED_OVERRIDE: 'MANUAL_APPROVED_OVERRIDE',
  HISTORICAL_APPROVED_RESULT: 'HISTORICAL_APPROVED_RESULT',
  FIXED_COMPONENTS_V1: 'FIXED_COMPONENTS_V1',
  LEGACY_WEIGHTED_V1: 'LEGACY_WEIGHTED_V1',
});

const RESULT_SOURCE_KIND = Object.freeze({
  APPROVED_OVERLAY: 'APPROVED_OVERLAY',
  LIVE_CALCULATION: 'LIVE_CALCULATION',
});

const INVALID_COMBINATION = Object.freeze({
  ELIGIBLE_EXPELLED: 'ELIGIBLE_EXPELLED',
  ELIGIBLE_FAILED: 'ELIGIBLE_FAILED',
  ELIGIBLE_BELOW_THRESHOLD: 'ELIGIBLE_BELOW_THRESHOLD',
  SCORE_OUT_OF_RANGE: 'SCORE_OUT_OF_RANGE',
  COMPONENT_OVER_MAX: 'COMPONENT_OVER_MAX',
});

/** Second Tafila opportunity — never merged with the primary online cohort. */
const SECONDARY_TAFILA_OPPORTUNITY_ID = '01666ebc-bfc1-4948-87a5-2add3f641c65';

const MANUAL_OVERRIDE_SOURCES = Object.freeze([
  'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
  'AUTHORIZED_ADMIN_OVERRIDE',
  'AUTHORIZED_ADMIN_ELIGIBILITY_DECISION',
]);

/**
 * Platform default for newly created opportunities (20/20/40/20).
 * Not applied retroactively to unstamped historical opportunities.
 */
const CURRENT_DEFAULT_SCORING_POLICY = Object.freeze({
  family: POLICY_FAMILY.FIXED_COMPONENTS_V1,
  version: 1,
  code: 'FIXED_COMPONENTS_20_20_40_20_V1',
  attendanceMax: 20,
  postMax: 20,
  tasksMax: 40,
  behaviorMax: 20,
  total: 100,
  qualificationThreshold: 80,
  renormalizeMissingComponents: false,
  requireAllRequiredTasksSubmitted: false,
  preAssessmentInScore: false,
  hoursInScore: false,
});

function num(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getApprovedOverlay(application) {
  const details = application?.eligibility_reason?.details;
  const approved = details?.approvedEvaluationResult;
  if (!approved || typeof approved !== 'object') return null;
  return approved;
}

function normalizePolicyCode(raw) {
  if (raw == null || raw === '') return null;
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function familyFromScoringPolicyCode(raw) {
  const key = normalizePolicyCode(raw);
  if (!key) return null;
  if (
    key === 'FIXED_COMPONENTS_V1' ||
    key === 'FIXED_COMPONENTS_20_20_40_20_V1' ||
    key === 'FIXED_COMPONENTS'
  ) {
    return POLICY_FAMILY.FIXED_COMPONENTS_V1;
  }
  if (key === 'LEGACY_WEIGHTED' || key === 'LEGACY_WEIGHTED_V1' || key === 'LEGACY') {
    return POLICY_FAMILY.LEGACY_WEIGHTED_V1;
  }
  return null;
}

function universityPolicyFamily(universityPolicy) {
  const model =
    universityPolicy?.scoringRules?.model ||
    universityPolicy?.scoring_rules?.model ||
    null;
  if (model === SCORING_MODEL.FIXED_COMPONENTS_V1 || model === 'fixed_components_v1') {
    return POLICY_FAMILY.FIXED_COMPONENTS_V1;
  }
  if (model === SCORING_MODEL.LEGACY_WEIGHTED_V1 || model === 'legacy_weighted_v1') {
    return POLICY_FAMILY.LEGACY_WEIGHTED_V1;
  }
  return null;
}

function opportunityConfiguredFamily(opportunity) {
  const rules = opportunity?.completion_rules;
  if (!rules || typeof rules !== 'object') return null;
  return familyFromScoringPolicyCode(rules.scoringPolicy || rules.scoring_policy || rules.scoringPolicyCode);
}

function isManualOverrideSource(source) {
  const key = String(source || '').trim().toUpperCase();
  return MANUAL_OVERRIDE_SOURCES.includes(key);
}

function historicalExceptionFor(opportunityId) {
  if (isPrimaryTafilaOpportunity(opportunityId)) return 'PRIMARY_TAFILA_ONLINE';
  return null;
}

function qualificationThresholdOf({ overlay, universityPolicy, opportunity, scoringModel } = {}) {
  const fromOverlay = num(overlay?.qualificationThreshold ?? overlay?.passingScore);
  if (fromOverlay != null) return fromOverlay;
  const fromOpp = num(opportunity?.completion_rules?.qualificationThreshold);
  if (fromOpp != null) return fromOpp;
  if (opportunityConfiguredFamily(opportunity) === POLICY_FAMILY.FIXED_COMPONENTS_V1) {
    return CURRENT_DEFAULT_SCORING_POLICY.qualificationThreshold;
  }
  const fromPolicy = num(
    universityPolicy?.minimumPassingScore ?? universityPolicy?.minimum_passing_score
  );
  if (fromPolicy != null) return fromPolicy;
  if (scoringModel === SCORING_MODEL.FIXED_COMPONENTS_V1) {
    return CURRENT_DEFAULT_SCORING_POLICY.qualificationThreshold;
  }
  return DEFAULT_POLICY.minimumPassingScore;
}

function underlyingScoringModel({ opportunity, universityPolicy, historicalException }) {
  const oppFamily = opportunityConfiguredFamily(opportunity);
  if (oppFamily === POLICY_FAMILY.FIXED_COMPONENTS_V1) return SCORING_MODEL.FIXED_COMPONENTS_V1;
  if (oppFamily === POLICY_FAMILY.LEGACY_WEIGHTED_V1) return SCORING_MODEL.LEGACY_WEIGHTED_V1;
  const uniFamily = universityPolicyFamily(universityPolicy);
  if (uniFamily === POLICY_FAMILY.FIXED_COMPONENTS_V1) return SCORING_MODEL.FIXED_COMPONENTS_V1;
  if (uniFamily === POLICY_FAMILY.LEGACY_WEIGHTED_V1) return SCORING_MODEL.LEGACY_WEIGHTED_V1;
  if (historicalException) return SCORING_MODEL.FIXED_COMPONENTS_V1;
  return SCORING_MODEL.LEGACY_WEIGHTED_V1;
}

function explicitRequireAllRequiredTasks(opportunity, universityPolicy) {
  if (opportunity?.completion_rules && 'requireAllRequiredTasksSubmitted' in opportunity.completion_rules) {
    return Boolean(opportunity.completion_rules.requireAllRequiredTasksSubmitted);
  }
  const rules = universityPolicy?.scoringRules || universityPolicy?.scoring_rules;
  if (rules && typeof rules === 'object' && 'requireAllRequiredTasksSubmitted' in rules) {
    return Boolean(rules.requireAllRequiredTasksSubmitted);
  }
  return undefined;
}

/**
 * Pure policy resolution. Does not load the database.
 *
 * @param {{ application?: object, opportunity?: object, universityPolicy?: object, student?: object }} input
 */
function resolveFieldTrainingPolicy({
  application = {},
  opportunity = {},
  universityPolicy = null,
  student = {},
} = {}) {
  const opportunityId = opportunity?.id || application?.opportunity_id || null;
  const overlay = getApprovedOverlay(application);
  const override = resolveEligibilityOverride({
    policy: universityPolicy || {},
    student,
    application,
  });
  const historicalException = historicalExceptionFor(opportunityId);
  const scoringModel = underlyingScoringModel({
    opportunity,
    universityPolicy,
    historicalException,
  });

  const manualFromOverlay = Boolean(overlay && isManualOverrideSource(overlay.source));
  const manualFromPolicy = Boolean(override?.applied);
  const isManualOverride = Boolean(manualFromOverlay || (manualFromPolicy && overlay));
  const hasApprovedOverlay = Boolean(overlay);

  let family;
  let resultSourceKind;
  let isHistoricalApprovedResult = false;
  let useLiveCalculation = true;
  let preserveApprovedOverlayOnPersist = false;
  let selectedBy;

  if (hasApprovedOverlay && isManualOverride) {
    family = POLICY_FAMILY.MANUAL_APPROVED_OVERRIDE;
    resultSourceKind = RESULT_SOURCE_KIND.APPROVED_OVERLAY;
    isHistoricalApprovedResult = Boolean(historicalException);
    useLiveCalculation = false;
    preserveApprovedOverlayOnPersist = true;
    selectedBy = 'manual_approved_override';
  } else if (hasApprovedOverlay) {
    family = POLICY_FAMILY.HISTORICAL_APPROVED_RESULT;
    resultSourceKind = RESULT_SOURCE_KIND.APPROVED_OVERLAY;
    isHistoricalApprovedResult = true;
    useLiveCalculation = false;
    preserveApprovedOverlayOnPersist = true;
    selectedBy = historicalException || 'approved_overlay';
  } else {
    const oppFamily = opportunityConfiguredFamily(opportunity);
    const uniFamily = universityPolicyFamily(universityPolicy);
    if (oppFamily) {
      family = oppFamily;
      selectedBy = 'opportunity_completion_rules';
    } else if (uniFamily) {
      family = uniFamily;
      selectedBy = 'university_evaluation_policy';
    } else {
      family = POLICY_FAMILY.LEGACY_WEIGHTED_V1;
      selectedBy = 'legacy_unstamped_fallback';
    }
    resultSourceKind = RESULT_SOURCE_KIND.LIVE_CALCULATION;
  }

  const requireAllRequiredTasksSubmitted = explicitRequireAllRequiredTasks(
    opportunity,
    universityPolicy
  );

  return {
    family,
    policyVersion:
      num(overlay?.policyVersion) ||
      num(opportunity?.completion_rules?.scoringPolicyVersion) ||
      num(universityPolicy?.version) ||
      CURRENT_DEFAULT_SCORING_POLICY.version,
    scoringModel,
    resultSourceKind,
    isHistoricalApprovedResult,
    isManualOverride,
    historicalException,
    useLiveCalculation,
    preserveApprovedOverlayOnPersist,
    qualificationThreshold: qualificationThresholdOf({
      overlay,
      universityPolicy,
      opportunity,
      scoringModel,
    }),
    renormalizeMissingComponents: scoringModel === SCORING_MODEL.LEGACY_WEIGHTED_V1,
    requireAllRequiredTasksSubmitted,
    preAssessmentInScore: false,
    hoursInScore: false,
    selectedBy,
    universityPolicyId: universityPolicy?.id || null,
    opportunityId,
    applicationId: application?.id || null,
    scoringCaps:
      scoringModel === SCORING_MODEL.FIXED_COMPONENTS_V1
        ? {
            attendance: CURRENT_DEFAULT_SCORING_POLICY.attendanceMax,
            post: CURRENT_DEFAULT_SCORING_POLICY.postMax,
            tasks: CURRENT_DEFAULT_SCORING_POLICY.tasksMax,
            behavior: CURRENT_DEFAULT_SCORING_POLICY.behaviorMax,
            total: CURRENT_DEFAULT_SCORING_POLICY.total,
          }
        : null,
    currentDefault: CURRENT_DEFAULT_SCORING_POLICY,
  };
}

/**
 * Apply the selected live scoring model onto a university evaluation policy
 * without mutating historical university rows.
 *
 * Existing FIXED university policies (Tafila) are returned unchanged.
 * Opportunity-stamped FIXED on a still-legacy university gets 20/20/40/20.
 */
function materializeQualificationPolicy(universityPolicy, resolved) {
  const base = universityPolicy && typeof universityPolicy === 'object' ? { ...universityPolicy } : {};
  const alreadyFixed =
    (base.scoringRules?.model || base.scoring_rules?.model) === SCORING_MODEL.FIXED_COMPONENTS_V1;

  if (resolved?.scoringModel !== SCORING_MODEL.FIXED_COMPONENTS_V1) {
    return base;
  }
  if (alreadyFixed) return base;

  const scoringRules = {
    ...(base.scoringRules && typeof base.scoringRules === 'object' ? base.scoringRules : {}),
    model: SCORING_MODEL.FIXED_COMPONENTS_V1,
    tasksScoringMode: TASKS_SCORING_MODE.GRADE_AVERAGE,
    renormalizeMissingComponents: false,
    scoreRequiredForEligibility: true,
    allowPassingScoreWithPartialTaskSubmissions: true,
    code: CURRENT_DEFAULT_SCORING_POLICY.code,
  };
  if (resolved.requireAllRequiredTasksSubmitted === false) {
    scoringRules.requireAllRequiredTasksSubmitted = false;
  } else if (resolved.requireAllRequiredTasksSubmitted === true) {
    scoringRules.requireAllRequiredTasksSubmitted = true;
  }

  return {
    ...base,
    attendanceWeight: CURRENT_DEFAULT_SCORING_POLICY.attendanceMax,
    postAssessmentWeight: CURRENT_DEFAULT_SCORING_POLICY.postMax,
    tasksWeight: CURRENT_DEFAULT_SCORING_POLICY.tasksMax,
    professionalEvaluationWeight: CURRENT_DEFAULT_SCORING_POLICY.behaviorMax,
    minimumPassingScore: resolved.qualificationThreshold || CURRENT_DEFAULT_SCORING_POLICY.qualificationThreshold,
    scoringRules,
  };
}

/**
 * Stamp new opportunities with an explicit current policy.
 * Existing `completion_rules.scoringPolicy` is left untouched.
 */
function defaultCompletionRulesForNewOpportunity(bodyCompletionRules) {
  const existing =
    bodyCompletionRules && typeof bodyCompletionRules === 'object' ? { ...bodyCompletionRules } : {};
  if (existing.scoringPolicy || existing.scoring_policy) return existing;
  return {
    ...existing,
    scoringPolicy: POLICY_FAMILY.FIXED_COMPONENTS_V1,
    scoringPolicyVersion: CURRENT_DEFAULT_SCORING_POLICY.version,
    qualificationThreshold: CURRENT_DEFAULT_SCORING_POLICY.qualificationThreshold,
    requireAllRequiredTasksSubmitted: false,
  };
}

function isCompletedAndIneligible(trainingStatus, eligibility) {
  const status = String(trainingStatus || '').toLowerCase();
  const elig = String(eligibility || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return status === 'completed' && (elig === 'NOT_ELIGIBLE' || elig === 'INELIGIBLE');
}

/**
 * Genuinely suspicious official-result combinations.
 * `completed` + ineligible is VALID and must never appear here.
 */
function validateOfficialResultIntegrity({
  eligibility,
  trainingStatus,
  finalScore,
  qualificationThreshold,
  attendancePoints,
  postPoints,
  taskPoints,
  behaviorPoints,
  isHistoricalApprovedResult = false,
  isManualOverride = false,
  scoringCaps = null,
  expelledAt = null,
} = {}) {
  const issues = [];
  const elig = String(eligibility || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const status = String(trainingStatus || '').toLowerCase();

  if (elig === 'ELIGIBLE' && (status === 'expelled' || Boolean(expelledAt))) {
    issues.push(INVALID_COMBINATION.ELIGIBLE_EXPELLED);
  }
  if (elig === 'ELIGIBLE' && status === 'failed') {
    issues.push(INVALID_COMBINATION.ELIGIBLE_FAILED);
  }

  const score = num(finalScore);
  if (score != null && (score > 100 || score < 0)) {
    issues.push(INVALID_COMBINATION.SCORE_OUT_OF_RANGE);
  }
  if (
    elig === 'ELIGIBLE' &&
    score != null &&
    qualificationThreshold != null &&
    score < Number(qualificationThreshold) &&
    !isHistoricalApprovedResult &&
    !isManualOverride
  ) {
    issues.push(INVALID_COMBINATION.ELIGIBLE_BELOW_THRESHOLD);
  }

  const caps = scoringCaps || CURRENT_DEFAULT_SCORING_POLICY;
  const components = [
    ['attendancePoints', caps.attendance || caps.attendanceMax || 20],
    ['postPoints', caps.post || caps.postMax || 20],
    ['taskPoints', caps.tasks || caps.tasksMax || 40],
    ['behaviorPoints', caps.behavior || caps.behaviorMax || 20],
  ];
  for (const [key, max] of components) {
    const value = num(
      key === 'attendancePoints'
        ? attendancePoints
        : key === 'postPoints'
          ? postPoints
          : key === 'taskPoints'
            ? taskPoints
            : behaviorPoints
    );
    if (value == null) continue;
    if (value < 0 || value > Number(max) + 0.05) {
      issues.push(value < 0 ? INVALID_COMBINATION.SCORE_OUT_OF_RANGE : INVALID_COMBINATION.COMPONENT_OVER_MAX);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    completedAndIneligibleIsValid: isCompletedAndIneligible(trainingStatus, eligibility),
  };
}

function logPolicyResolution(policy, extra = {}) {
  if (!policy) return;
  log('info', 'field_training.policy.resolved', {
    applicationId: policy.applicationId,
    policy: policy.family,
    policyVersion: policy.policyVersion,
    resultSource: policy.resultSourceKind,
    manualOverrideApplied: policy.isManualOverride,
    historicalApprovedResultApplied: policy.isHistoricalApprovedResult,
    selectedBy: policy.selectedBy,
    ...extra,
  });
}

module.exports = {
  POLICY_FAMILY,
  RESULT_SOURCE_KIND,
  INVALID_COMBINATION,
  CURRENT_DEFAULT_SCORING_POLICY,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  SECONDARY_TAFILA_OPPORTUNITY_ID,
  getApprovedOverlay,
  resolveFieldTrainingPolicy,
  materializeQualificationPolicy,
  defaultCompletionRulesForNewOpportunity,
  validateOfficialResultIntegrity,
  isCompletedAndIneligible,
  logPolicyResolution,
  isPrimaryTafilaOpportunity,
};
