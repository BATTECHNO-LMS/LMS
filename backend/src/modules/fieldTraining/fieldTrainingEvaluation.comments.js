'use strict';

const crypto = require('crypto');
const { reportEligibilityStatus } = require('./fieldTrainingEvaluation.eligibilityReasons');

const ELIGIBLE_FORMAL_TEMPLATES = Object.freeze([
  'أتم الطالب متطلبات التدريب الميداني بنجاح، واستكمل التقييم القبلي والبعدي والتسليمات المطلوبة، وحقق متطلبات الحضور والساعات التدريبية المعتمدة.',
  'استوفى الطالب متطلبات برنامج التدريب الميداني، وأكمل التقييمين القبلي والبعدي والمهام والتسليمات المطلوبة، مع الالتزام بمتطلبات الحضور والساعات التدريبية.',
  'أكمل الطالب متطلبات التدريب الميداني المعتمدة، بما يشمل التقييم القبلي والبعدي والتسليمات والحضور والساعات التدريبية المطلوبة.',
  'أتم الطالب متطلبات برنامج التدريب الميداني بنجاح، بما في ذلك التقييم القبلي والتقييم البعدي والتسليمات المطلوبة، كما استوفى متطلبات الحضور والساعات التدريبية المعتمدة.',
]);

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

function pickDeterministicTemplate(studentKey, templates) {
  const digest = crypto.createHash('sha256').update(String(studentKey || 'eligible')).digest();
  return templates[digest[0] % templates.length];
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function verifiedCompletion(options = {}) {
  return {
    preAssessmentCompleted: options.preAssessmentCompleted === true,
    postAssessmentCompleted: options.postAssessmentCompleted === true,
    requiredSubmissionsCompleted: options.requiredSubmissionsCompleted === true,
    attendanceRequirementMet: options.attendanceRequirementMet === true,
    requiredHoursCompleted: options.requiredHoursCompleted === true,
  };
}

function completionFlagsFromScoringInput(scoringInput = {}, opportunity = {}, overrides = {}) {
  const requiredHours = num(scoringInput.requiredHours ?? opportunity.required_training_hours);
  const completedHours = num(scoringInput.completedHours);
  const minAtt = num(opportunity.minimum_attendance_percentage);
  const att = num(scoringInput.attendancePercentage);
  const requiredTasks = num(scoringInput.requiredTaskCount) || 0;
  const acceptedTasks = num(scoringInput.acceptedTaskCount) || 0;
  return verifiedCompletion({
    preAssessmentCompleted:
      overrides.preAssessmentCompleted ??
      (scoringInput.preAssessmentScore != null && scoringInput.preAssessmentScore !== ''),
    postAssessmentCompleted:
      overrides.postAssessmentCompleted ??
      (scoringInput.postAssessmentScore != null && scoringInput.postAssessmentScore !== ''),
    requiredSubmissionsCompleted:
      overrides.requiredSubmissionsCompleted ??
      (requiredTasks > 0 && acceptedTasks >= requiredTasks),
    attendanceRequirementMet:
      overrides.attendanceRequirementMet ??
      (att != null && (minAtt == null || att >= minAtt)),
    requiredHoursCompleted:
      overrides.requiredHoursCompleted ??
      (completedHours != null && requiredHours != null && completedHours >= requiredHours),
  });
}

function allCoreRequirementsComplete(verified) {
  return (
    verified.preAssessmentCompleted &&
    verified.postAssessmentCompleted &&
    verified.requiredSubmissionsCompleted &&
    verified.attendanceRequirementMet &&
    verified.requiredHoursCompleted
  );
}

function buildEligibleFormalComment(options = {}) {
  const verified = verifiedCompletion(options);
  if (allCoreRequirementsComplete(verified)) {
    return pickDeterministicTemplate(
      options.studentKey || options.studentNumber || options.applicationId,
      ELIGIBLE_FORMAL_TEMPLATES
    );
  }
  const parts = [];
  if (verified.preAssessmentCompleted) parts.push('التقييم القبلي');
  if (verified.postAssessmentCompleted) parts.push('التقييم البعدي');
  if (verified.requiredSubmissionsCompleted) parts.push('التسليمات المطلوبة');
  if (verified.attendanceRequirementMet) parts.push('متطلبات الحضور');
  if (verified.requiredHoursCompleted) parts.push('الساعات التدريبية المعتمدة');
  if (!parts.length) return 'حالة الطالب: مؤهل';
  return `أتم الطالب المتطلبات التالية في برنامج التدريب الميداني: ${parts.join(' و')}.`;
}

function buildNotEligibleComment(reasonLines = []) {
  const lines = (reasonLines || [])
    .map((line) => String(line || '').replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  const reasons = lines.length
    ? lines.map((line) => `- ${line}`).join('؛ ')
    : '- لم يستوف الطالب متطلبات التدريب الميداني.';
  return `حالة الطالب: غير مؤهل\nأسباب عدم التأهيل:\n${reasons}`;
}

function buildMutahEvaluationComment(application = {}, evaluation = {}, options = {}) {
  const eligibility =
    options.eligibilityStatus ||
    evaluation.eligibilityStatus ||
    reportEligibilityStatus(application, evaluation.finalStatus);
  const reasonLines = Array.isArray(options.reasonLabels)
    ? options.reasonLabels
    : Array.isArray(evaluation.eligibilityReasonLabels)
      ? evaluation.eligibilityReasonLabels
      : [];
  if (String(eligibility).toUpperCase() === 'ELIGIBLE' || eligibility === 'eligible') {
    return buildEligibleFormalComment(options);
  }
  return buildNotEligibleComment(reasonLines);
}

function buildEligibleComment(evaluation = {}, options = {}) {
  return buildEligibleFormalComment({ ...options, ...evaluation });
}

function buildAutoComment(evaluation = {}, options = {}) {
  return buildMutahEvaluationComment(
    { completion_eligibility_status: evaluation.completionStatus || evaluation.eligibilityStatus },
    evaluation,
    options
  );
}

module.exports = {
  ELIGIBLE_FORMAL_TEMPLATES,
  buildAutoComment,
  buildEligibleComment,
  buildEligibleFormalComment,
  buildNotEligibleComment,
  buildMutahEvaluationComment,
  verifiedCompletion,
  completionFlagsFromScoringInput,
  performanceSummary,
};
