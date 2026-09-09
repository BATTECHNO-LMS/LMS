'use strict';

/**
 * Shared presentation helpers for university/student-facing Field Training reports.
 * Keeps internal enums/IDs out of visible PDF/HTML while preserving backend data.
 */

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

const APPLICATION_STATUS_AR = Object.freeze({
  pending: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
});

const TRAINING_STATUS_AR = Object.freeze({
  none: 'لم يبدأ',
  pre_assessment_pending: 'بانتظار الاختبار القبلي',
  pre_assessment_completed: 'اكتمل الاختبار القبلي',
  ready_for_training: 'جاهز للتدريب',
  in_training: 'قيد التدريب',
  task_pending: 'بانتظار المهام',
  task_submitted: 'تم تسليم المهام',
  post_assessment_pending: 'بانتظار الاختبار البعدي',
  post_assessment_completed: 'اكتمل الاختبار البعدي',
  eligible_for_completion: 'مؤهل للإنهاء',
  completed: 'مكتمل',
  failed: 'غير مكتمل',
  expelled: 'مستبعد',
});

const ELIGIBILITY_STATUS_AR = Object.freeze({
  pending: 'قيد الاستكمال',
  eligible: 'مؤهل',
  ineligible: 'غير مؤهل',
  not_eligible: 'غير مؤهل',
  needs_review: 'يحتاج مراجعة',
});

const SOURCE_HUMAN_AR = Object.freeze({
  AUTHORIZED_MANUAL_REVIEW: 'مراجعة واعتماد نهائي',
  AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT: 'مراجعة واعتماد نهائي',
  AUTHORIZED_MANUAL_REVIEW_TASK_NORMALIZATION: 'مراجعة واعتماد نهائي',
  EXCEL_BASELINE: 'النتيجة النهائية المعتمدة',
  AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE: 'قرار إداري معتمد',
  AUTHORIZED_GRADE_OVERRIDE: 'قرار إداري معتمد',
  VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE: 'النتيجة النهائية المعتمدة',
  NUMERIC_GRADE: 'مراجعة واعتماد نهائي',
  MISSING_OR_NOT_ACCEPTED: null,
});

const TECHNICAL_TOKEN_RE =
  /\b(EXCEL_BASELINE|AUTHORIZED_[A-Z0-9_]+|VERIFIED_[A-Z0-9_]+|applicationId|opportunityId|rawScore|approvedScore|NOT_ELIGIBLE|ELIGIBLE|FORCE_NOT_ELIGIBLE)\b/i;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripLongDashes(value) {
  return String(value ?? '')
    .replaceAll(EM_DASH, '-')
    .replaceAll(EN_DASH, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isBlank(value) {
  if (value == null) return true;
  const s = String(value).trim();
  return !s || s === EM_DASH || s === EN_DASH || s === '-' || s === '—';
}

function displayValue(value, fallback = 'غير متوفر') {
  if (isBlank(value)) return fallback;
  return stripLongDashes(value);
}

function formatDateAr(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return null;
  }
}

function formatDateRangeAr(start, end) {
  const a = formatDateAr(start) || (typeof start === 'string' ? start : null);
  const b = formatDateAr(end) || (typeof end === 'string' ? end : null);
  if (a && b) return `من ${a} إلى ${b}`;
  if (a) return `من ${a}`;
  if (b) return `حتى ${b}`;
  return null;
}

function ltrScore(earned, max) {
  if (earned == null || earned === '') return null;
  if (max == null || max === '') return String(earned);
  return `${earned} / ${max}`;
}

function scoreHtml(earned, max, empty = 'غير متوفر') {
  const text = ltrScore(earned, max);
  if (!text) return esc(empty);
  return `<span dir="ltr">${esc(text)}</span>`;
}

function countOfHtml(done, total, empty = 'غير متوفر') {
  if (done == null || total == null) return esc(empty);
  return esc(`${done} من ${total}`);
}

function labelApplicationStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return APPLICATION_STATUS_AR[key] || displayValue(status, 'غير محدد');
}

function labelTrainingStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return TRAINING_STATUS_AR[key] || displayValue(status, 'غير محدد');
}

function labelEligibilityStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'مؤهل') return 'مؤهل';
  if (key === 'غير مؤهل') return 'غير مؤهل';
  return ELIGIBILITY_STATUS_AR[key] || displayValue(status, 'غير محدد');
}

function labelSourceHuman(source) {
  if (!source) return null;
  const key = String(source).trim();
  if (SOURCE_HUMAN_AR[key] !== undefined) return SOURCE_HUMAN_AR[key];
  if (TECHNICAL_TOKEN_RE.test(key)) return 'النتيجة النهائية المعتمدة';
  return stripLongDashes(key);
}

function sanitizeVisibleText(value, fallback = 'غير متوفر') {
  if (isBlank(value)) return fallback;
  const text = stripLongDashes(value);
  if (TECHNICAL_TOKEN_RE.test(text)) return fallback;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    return fallback;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    return formatDateAr(text) || fallback;
  }
  return text;
}

function cleanSessionTitle(title) {
  if (!title) return 'جلسة تدريبية';
  let t = stripLongDashes(String(title));
  t = t
    .replace(/\s*[-–—]\s*جامعة.*$/u, '')
    .replace(/\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || 'جلسة تدريبية';
}

function isEligibleStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return key === 'eligible' || key === 'مؤهل';
}

function isNotEligibleStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return (
    key === 'ineligible' ||
    key === 'not_eligible' ||
    key === 'not-eligible' ||
    key === 'غير مؤهل'
  );
}

/**
 * Build natural Arabic decision reasons for not-eligible students.
 * Prefer factual training evidence over internal admin override wording.
 */
function buildNotEligibleReasonsAr(report = {}) {
  const q = report.eligibility || {};
  const tasks = report.tasks || {};
  const pro = report.professionalEvaluation || {};
  const reasons = [];

  const submitted = (tasks.items || []).filter(
    (t) => t.submissionStatus !== 'NOT_SUBMITTED' && t.submissionStatus !== 'missing'
  ).length;
  const required = tasks.requiredCount ?? (tasks.items || []).length;
  if (required > 0 && submitted < required) {
    reasons.push(`تم تسليم ${submitted} من أصل ${required} تاسكات مطلوبة.`);
  }

  const incompleteBehavior =
    (pro.criteria || []).some((c) => c.score == null) ||
    q.mandatoryGates?.some(
      (g) =>
        (g.key === 'behavior' || String(g.nameAr || '').includes('سلوك')) &&
        (g.status === 'incomplete' || g.status === 'failed' || g.labelAr === 'غير مكتمل')
    );
  if (incompleteBehavior) {
    reasons.push('لم يكتمل تقييم جميع معايير السلوك والالتزام.');
  }

  const finalScore = q.finalScore ?? report.scoring?.finalScore;
  const passing = q.passingScore ?? report.scoring?.passingScore ?? 80;
  if (finalScore != null && Number(finalScore) < Number(passing)) {
    reasons.push(
      `حصل الطالب على ${finalScore} من 100، وهي أقل من الحد الأدنى للتأهيل البالغ ${passing} من 100.`
    );
  }

  const existing = Array.isArray(q.eligibilityReasonLabels) ? q.eligibilityReasonLabels : [];
  for (const label of existing) {
    const clean = sanitizeVisibleText(label, '');
    if (!clean) continue;
    if (/قرار إداري|الاحتفاظ بالعلامات|AUTHORIZED|OVERRIDE/i.test(clean)) continue;
    if (reasons.some((r) => r.includes(String(finalScore)) && clean.includes(String(finalScore)))) {
      continue;
    }
    if (!reasons.includes(clean)) reasons.push(clean.endsWith('.') ? clean : `${clean}.`);
  }

  if (!reasons.length) {
    reasons.push('لم يستوفِ الطالب متطلبات التأهيل المعتمدة.');
  }
  return reasons;
}

function assertNoForbiddenPresentation(text) {
  const raw = String(text || '');
  const findings = [];
  if (raw.includes(EM_DASH)) findings.push('long_dash');
  if (TECHNICAL_TOKEN_RE.test(raw)) findings.push('technical_token');
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(raw)) {
    findings.push('uuid');
  }
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) findings.push('iso_timestamp');
  return findings;
}

module.exports = {
  EM_DASH,
  APPLICATION_STATUS_AR,
  TRAINING_STATUS_AR,
  ELIGIBILITY_STATUS_AR,
  SOURCE_HUMAN_AR,
  esc,
  stripLongDashes,
  isBlank,
  displayValue,
  formatDateAr,
  formatDateRangeAr,
  ltrScore,
  scoreHtml,
  countOfHtml,
  labelApplicationStatus,
  labelTrainingStatus,
  labelEligibilityStatus,
  labelSourceHuman,
  sanitizeVisibleText,
  cleanSessionTitle,
  isEligibleStatus,
  isNotEligibleStatus,
  buildNotEligibleReasonsAr,
  assertNoForbiddenPresentation,
};
