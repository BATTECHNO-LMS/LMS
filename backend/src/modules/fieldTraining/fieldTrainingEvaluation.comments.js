'use strict';

const { FINAL_STATUS, GATE_REASON_LABELS_AR } = require('./fieldTrainingEvaluation.constants');

function strengthPhrase(score, strong, mid) {
  if (score == null) return null;
  if (score >= 4) return strong;
  if (score >= 3) return mid;
  return null;
}

function weaknessPhrase(score, text) {
  if (score == null) return null;
  if (score <= 2) return text;
  return null;
}

function buildAutoComment(evaluation = {}) {
  const status = evaluation.finalStatus;
  const reasons = Array.isArray(evaluation.eligibilityReasons) ? evaluation.eligibilityReasons : [];
  const attendance = evaluation.attendanceComponentScore;
  const tasks = evaluation.tasksComponentScore;
  const post = evaluation.postAssessmentScore;
  const c3 = evaluation.criterion3Score;
  const c4 = evaluation.criterion4Score;
  const c6 = evaluation.criterion6Score;
  const c8 = evaluation.criterion8Score;

  if (status === FINAL_STATUS.NOT_ELIGIBLE) {
    const labels = reasons.map((code) => GATE_REASON_LABELS_AR[code] || code).filter(Boolean);
    const reasonText = labels.length ? labels.join('، ') : 'لم تُستكمل متطلبات الأهلية';
    return `لم يستكمل الطالب متطلبات الأهلية لإصدار نتيجة نجاح أو رسوب. الأسباب: ${reasonText}.`;
  }

  const parts = [];
  if (attendance != null && attendance >= 95) {
    parts.push('أظهر الطالب مستوى متميزاً من الالتزام بالحضور وأوقات العمل');
  } else if (attendance != null && attendance >= 80) {
    parts.push('التزم الطالب بنسبة حضور مقبولة خلال فترة التدريب');
  } else if (attendance != null) {
    parts.push('كان الالتزام بالحضور أقل من المستوى المطلوب');
  }

  if (tasks != null && tasks >= 90) {
    parts.push('وأتم المهام المطلوبة بكفاءة عالية');
  } else if (tasks != null && tasks >= 60) {
    parts.push('وأنجز معظم المهام المطلوبة');
  } else if (tasks != null) {
    parts.push('ولم يستكمل المهام المطلوبة بالمستوى المتوقع');
  }

  const strengths = [
    strengthPhrase(c4, 'حل المشكلات', 'حل المشكلات'),
    strengthPhrase(c6, 'التعاون', 'التعاون'),
    strengthPhrase(c8, 'الالتزام بتعليمات المؤسسة', 'التعاون مع المشرف'),
    strengthPhrase(c3, 'المبادرة والتفكير', null),
  ].filter(Boolean);

  if (strengths.length) {
    parts.push(`كما أظهر مستوى جيداً جداً في ${strengths.join(' و')}`);
  }

  const weaknesses = [
    weaknessPhrase(c4, 'يحتاج إلى تعزيز مهارات حل المشكلات'),
    weaknessPhrase(c6, 'يحتاج إلى تطوير التعاون مع الزملاء'),
    weaknessPhrase(evaluation.criterion2Score, 'يحتاج إلى رفع دقة العمل'),
  ].filter(Boolean);

  if (post != null && post >= 80) {
    parts.push('وحقق نتيجة جيدة في الامتحان البعدي');
  } else if (post != null && post < 60) {
    parts.push('وكانت نتيجة الامتحان البعدي دون المستوى المطلوب');
  }

  if (weaknesses.length && status === FINAL_STATUS.FAILED) {
    parts.push(weaknesses[0]);
  }

  let sentence = parts.join('، ');
  if (!sentence) sentence = 'أُعد هذا التقييم بناءً على سجلات الحضور والمهام والنتائج المتاحة';
  if (!sentence.endsWith('.')) sentence += '.';

  if (status === FINAL_STATUS.PASSED) {
    return sentence.charAt(0) === 'أ' ? sentence : `أ${sentence.replace(/^و/, '')}`;
  }
  return `أظهر الطالب أداءً دون درجة النجاح المعتمدة. ${sentence}`;
}

module.exports = { buildAutoComment };
