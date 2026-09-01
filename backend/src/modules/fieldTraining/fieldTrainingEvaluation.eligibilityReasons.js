'use strict';

const { ELIGIBILITY_REASON_CODES, GATE_REASONS } = require('./fieldTrainingEvaluation.constants');

const WORKFLOW_TO_CANONICAL = Object.freeze({
  attendance_below_minimum: ELIGIBILITY_REASON_CODES.ATTENDANCE_BELOW_MINIMUM,
  training_hours_incomplete: ELIGIBILITY_REASON_CODES.REQUIRED_HOURS_INCOMPLETE,
  post_assessment_missing: ELIGIBILITY_REASON_CODES.POST_ASSESSMENT_INCOMPLETE,
  post_assessment_below_minimum: ELIGIBILITY_REASON_CODES.POST_ASSESSMENT_INCOMPLETE,
  final_task_not_submitted: ELIGIBILITY_REASON_CODES.REQUIRED_TASKS_INCOMPLETE,
  final_task_rejected: ELIGIBILITY_REASON_CODES.REQUIRED_TASKS_INCOMPLETE,
  [GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED]: ELIGIBILITY_REASON_CODES.ATTENDANCE_BELOW_MINIMUM,
  [GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED]: ELIGIBILITY_REASON_CODES.REQUIRED_HOURS_INCOMPLETE,
  [GATE_REASONS.REQUIRED_SUBMISSION_MISSING]: ELIGIBILITY_REASON_CODES.REQUIRED_TASKS_INCOMPLETE,
  [GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED]: ELIGIBILITY_REASON_CODES.POST_ASSESSMENT_INCOMPLETE,
});

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractStoredReasons(application = {}) {
  const raw = application.eligibility_reason;
  if (!raw) return [];
  if (Array.isArray(raw.reasons)) return raw.reasons.filter(Boolean);
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return [];
}

function extractStoredDetails(application = {}) {
  const raw = application.eligibility_reason;
  if (raw && typeof raw === 'object' && raw.details && typeof raw.details === 'object') {
    return raw.details;
  }
  return {};
}

function canonicalizeReasonCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return null;
  if (Object.values(ELIGIBILITY_REASON_CODES).includes(raw)) return raw;
  if (WORKFLOW_TO_CANONICAL[raw]) return WORKFLOW_TO_CANONICAL[raw];
  if (raw === 'expelled' || raw === 'failed' || raw === 'application_not_found') {
    return ELIGIBILITY_REASON_CODES.OTHER_EXISTING_ELIGIBILITY_RULE;
  }
  return ELIGIBILITY_REASON_CODES.OTHER_EXISTING_ELIGIBILITY_RULE;
}

function formatAttendanceReason(details = {}, evidence = {}) {
  const actual = num(details.attendance_percentage ?? evidence.attendancePercentage);
  const required = num(details.minimum_attendance_percentage ?? evidence.minimumAttendancePercentage ?? 80);
  if (actual != null && required != null) {
    return `لم يحقق الطالب الحد الأدنى المطلوب للحضور (${actual}% من أصل ${required}%).`;
  }
  if (required != null) {
    return `لم يحقق الطالب الحد الأدنى المطلوب للحضور (${required}%).`;
  }
  return 'لم يحقق الطالب الحد الأدنى المطلوب للحضور.';
}

function formatHoursReason(details = {}, evidence = {}) {
  const progress = details.training_hours && typeof details.training_hours === 'object' ? details.training_hours : {};
  const completed = num(
    progress.completed_hours ?? progress.completedHours ?? evidence.completedHours
  );
  const required = num(
    progress.required_hours ?? progress.requiredHours ?? evidence.requiredHours
  );
  if (completed != null && required != null) {
    return `استكمل الطالب ${completed} ساعة من أصل ${required} ساعة مطلوبة.`;
  }
  if (required != null) {
    return `لم يستكمل الطالب الساعات التدريبية المطلوبة (${required} ساعة).`;
  }
  return 'لم يستكمل الطالب الساعات التدريبية المطلوبة.';
}

function formatTasksReason(details = {}, evidence = {}) {
  const required = num(evidence.requiredTaskCount ?? details.required_task_count);
  const accepted = num(evidence.acceptedTaskCount ?? details.accepted_task_count);
  if (required != null && required > 0 && accepted != null) {
    const missing = Math.max(0, required - accepted);
    if (missing > 0) {
      return `لم يستكمل الطالب ${missing} من المهام المطلوبة.`;
    }
  }
  if (details.final_task_status) {
    return 'لم يستكمل الطالب المهمة النهائية المطلوبة.';
  }
  return 'لم يستكمل الطالب المهام المطلوبة.';
}

function formatPostAssessmentReason() {
  return 'لم يستكمل الطالب التقييم البعدي.';
}

function formatOtherReason(originalCode) {
  const map = {
    expelled: 'أُلغي تدريب الطالب.',
    failed: 'رُصد رسوب الطالب في التدريب الميداني.',
  };
  return map[originalCode] || 'لم يستوف الطالب أحد شروط أهلية الإنهاء المعتمدة في المنصة.';
}

/**
 * Deterministic Arabic reasons from the existing Field Training eligibility engine.
 * Does not invent a competing eligibility algorithm.
 */
function buildFieldTrainingEligibilityReasons({
  application = {},
  codes = null,
  evidence = {},
} = {}) {
  const stored = extractStoredReasons(application);
  const details = extractStoredDetails(application);
  const sourceCodes = Array.isArray(codes) && codes.length ? codes : stored;
  const seen = new Set();
  const items = [];
  for (const raw of sourceCodes) {
    const canonical = canonicalizeReasonCode(raw);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    let text = '';
    if (canonical === ELIGIBILITY_REASON_CODES.ATTENDANCE_BELOW_MINIMUM) {
      text = formatAttendanceReason(details, evidence);
    } else if (canonical === ELIGIBILITY_REASON_CODES.REQUIRED_HOURS_INCOMPLETE) {
      text = formatHoursReason(details, evidence);
    } else if (canonical === ELIGIBILITY_REASON_CODES.REQUIRED_TASKS_INCOMPLETE) {
      text = formatTasksReason(details, evidence);
    } else if (canonical === ELIGIBILITY_REASON_CODES.POST_ASSESSMENT_INCOMPLETE) {
      text = formatPostAssessmentReason();
    } else {
      text = formatOtherReason(raw);
    }
    items.push({ code: canonical, sourceCode: raw, text });
  }
  return {
    codes: items.map((item) => item.code),
    labelsAr: items.map((item) => item.text),
    text: items.map((item) => item.text).join('\n'),
    items,
  };
}

function isEligibleStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  return raw === 'eligible' || raw === 'eligibile';
}

function reportEligibilityStatus(application = {}, fallback = 'NOT_ELIGIBLE') {
  const stored = String(application.completion_eligibility_status || '').trim().toLowerCase();
  if (isEligibleStatus(stored)) return 'ELIGIBLE';
  if (stored === 'ineligible' || stored === 'not_eligible' || stored === 'needs_review' || stored === 'pending') {
    return 'NOT_ELIGIBLE';
  }
  if (fallback == null || fallback === '') return 'NOT_ELIGIBLE';
  const fb = String(fallback).toUpperCase();
  return fb === 'ELIGIBLE' ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
}

/** Authoritative eligibility bucket from stored application status. */
function eligibilityBucket(application = {}) {
  const stored = String(application.completion_eligibility_status || '').trim().toLowerCase();
  if (isEligibleStatus(stored)) return 'ELIGIBLE';
  if (stored === 'ineligible' || stored === 'not_eligible') return 'NOT_ELIGIBLE';
  if (stored === 'pending' || stored === 'needs_review' || !stored) return 'PENDING';
  return 'NOT_ELIGIBLE';
}

module.exports = {
  buildFieldTrainingEligibilityReasons,
  extractStoredReasons,
  extractStoredDetails,
  canonicalizeReasonCode,
  isEligibleStatus,
  reportEligibilityStatus,
  eligibilityBucket,
};
