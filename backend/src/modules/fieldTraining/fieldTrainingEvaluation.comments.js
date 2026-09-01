'use strict';

const { reportEligibilityStatus } = require('./fieldTrainingEvaluation.eligibilityReasons');

function strengthPhrase(score, strong) {
  if (score == null) return null;
  if (score >= 4) return strong;
  return null;
}

function weaknessPhrase(score, text) {
  if (score == null) return null;
  if (score <= 2) return text;
  return null;
}

function performanceSummary(evaluation = {}) {
  const parts = [];
  const attendance = evaluation.attendanceComponentScore;
  const total = evaluation.professionalTotal;
  if (total != null) {
    if (total >= 40) parts.push('وأظهر أداءً مهنياً متميزاً وفق بنود التقييم المعتمدة');
    else if (total >= 30) parts.push('وأظهر أداءً مهنياً جيدًا وفق بنود التقييم المعتمدة');
    else parts.push('ويحتاج إلى مزيد من التطوير في بعض جوانب الأداء المهني');
  }
  if (attendance != null && attendance >= 95) {
    parts.push('مع التزام واضح بالحضور');
  } else if (attendance != null && attendance >= 80) {
    parts.push('مع التزام مقبول بالحضور');
  }
  const strengths = [
    strengthPhrase(evaluation.criterion4Score, 'حل المشكلات'),
    strengthPhrase(evaluation.criterion6Score, 'التعاون مع الزملاء'),
    strengthPhrase(evaluation.criterion3Score, 'التفكير والمبادرة'),
  ].filter(Boolean);
  if (strengths.length) {
    parts.push(`وبرز في ${strengths.join(' و')}`);
  }
  const weakness = weaknessPhrase(evaluation.criterion2Score, 'مع الحاجة إلى رفع دقة العمل');
  if (weakness) parts.push(weakness);
  return parts.join('، ');
}

function buildEligibleComment() {
  return 'حالة الطالب: مؤهل\n\nأتم الطالب متطلبات التدريب الميداني واستوفى متطلبات الحضور والساعات والتسليمات والتقييم البعدي، وقد تم تقييم أدائه وفق البيانات المسجلة في المنصة.';
}

function buildNotEligibleComment(reasonLines = []) {
  const lines = (reasonLines || []).filter(Boolean);
  const reasons = lines.length
    ? lines.map((line) => `* ${String(line).replace(/^\*\s*/, '')}`).join('\n')
    : '* لم يستوف الطالب متطلبات الأهلية المعتمدة في المنصة.';
  return `حالة الطالب: غير مؤهل\n\nأسباب عدم التأهيل:\n${reasons}`;
}

function buildAutoComment(evaluation = {}, options = {}) {
  const eligibility =
    options.eligibilityStatus ||
    evaluation.eligibilityStatus ||
    reportEligibilityStatus({ completion_eligibility_status: evaluation.completionStatus }, evaluation.finalStatus);
  const reasonLines = Array.isArray(options.reasonLabels)
    ? options.reasonLabels
    : Array.isArray(evaluation.eligibilityReasonLabels)
      ? evaluation.eligibilityReasonLabels
      : [];
  if (String(eligibility).toUpperCase() === 'ELIGIBLE' || eligibility === 'eligible') {
    return buildEligibleComment(evaluation);
  }
  if (reasonLines.length) {
    return buildNotEligibleComment(reasonLines);
  }
  return buildNotEligibleComment([]);
}

module.exports = {
  buildAutoComment,
  buildEligibleComment,
  buildNotEligibleComment,
  performanceSummary,
};
