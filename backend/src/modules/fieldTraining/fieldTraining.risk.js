'use strict';

const { READINESS_STATES, READINESS_REASONS } = require('./fieldTraining.readiness');

const RISK_LEVELS = Object.freeze({
  NONE: 'NONE',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const RISK_SIGNALS = Object.freeze({
  LOW_ATTENDANCE: 'LOW_ATTENDANCE',
  LOW_SCORE: 'LOW_SCORE',
  MISSING_POST: 'MISSING_POST',
  TASKS_OVERDUE: 'TASKS_OVERDUE',
  MULTIPLE_TASKS_PENDING: 'MULTIPLE_TASKS_PENDING',
  NO_RECENT_ACTIVITY: 'NO_RECENT_ACTIVITY',
  HOURS_BEHIND_EXPECTED: 'HOURS_BEHIND_EXPECTED',
  RECORDED_LECTURE_NOT_STARTED: 'RECORDED_LECTURE_NOT_STARTED',
  RECORDED_LECTURE_INCOMPLETE: 'RECORDED_LECTURE_INCOMPLETE',
  BEHAVIOR_REVIEW_REQUIRED: 'BEHAVIOR_REVIEW_REQUIRED',
  EVALUATION_PENDING: 'EVALUATION_PENDING',
  COMPLETION_BLOCKED: 'COMPLETION_BLOCKED',
});

const SIGNAL_LABELS_AR = Object.freeze({
  LOW_ATTENDANCE: 'حضور منخفض',
  LOW_SCORE: 'درجة منخفضة',
  MISSING_POST: 'POST غير مكتمل',
  TASKS_OVERDUE: 'مهام متأخرة',
  MULTIPLE_TASKS_PENDING: 'مهام متعددة معلّقة',
  NO_RECENT_ACTIVITY: 'لا يوجد نشاط تدريبي حديث',
  HOURS_BEHIND_EXPECTED: 'الساعات خلف الجدول المتوقع',
  RECORDED_LECTURE_NOT_STARTED: 'لم يبدأ المحاضرة المسجلة',
  RECORDED_LECTURE_INCOMPLETE: 'محاضرة مسجلة غير مكتملة',
  BEHAVIOR_REVIEW_REQUIRED: 'يتطلب تقييم سلوكي',
  EVALUATION_PENDING: 'تقييم معلّق',
  COMPLETION_BLOCKED: 'الإكمال متعثر',
});

const LEVEL_LABELS_AR = Object.freeze({
  NONE: 'لا يوجد',
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'مرتفع',
  CRITICAL: 'حرج',
});

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  const a = new Date(from).getTime();
  if (Number.isNaN(a)) return null;
  return Math.floor((to.getTime() - a) / (24 * 3600 * 1000));
}

function pushSignal(signals, code, detail_ar, weight) {
  if (signals.some((s) => s.code === code)) return;
  signals.push({
    code,
    label_ar: SIGNAL_LABELS_AR[code] || code,
    detail_ar: detail_ar || SIGNAL_LABELS_AR[code] || code,
    weight,
  });
}

/**
 * Deterministic, explainable Field Training risk evaluation.
 * @param {{
 *   application?: object,
 *   opportunity?: object,
 *   readiness?: object,
 *   qualification?: object|null,
 *   overdueTasks?: Array<{id:string,title?:string,due_date?:string}>,
 *   pendingRequiredTasksCount?: number,
 *   attendance?: { percentage?: number|null, absentCount?: number, requiredCount?: number, minimumPercentage?: number|null },
 *   lectures?: Array<{id:string,title?:string,progress_percent?:number,completed_at?:string|null,available_at?:string|null}>,
 *   lastMeaningfulActivityAt?: string|Date|null,
 *   now?: Date,
 *   expectedHoursProgress?: { expected?: number|null, completed?: number|null, supported?: boolean },
 * }} input
 */
function evaluateFieldTrainingRisk(input = {}) {
  const app = input.application || {};
  const readiness = input.readiness || {};
  const qualification = input.qualification || null;
  const overdueTasks = input.overdueTasks || [];
  const lectures = input.lectures || [];
  const attendance = input.attendance || {};
  const now = input.now || new Date();
  const signals = [];

  if (['expelled', 'failed'].includes(app.training_status) || app.status === 'rejected') {
    return {
      riskLevel: RISK_LEVELS.NONE,
      risk_level: RISK_LEVELS.NONE,
      risk_level_label_ar: LEVEL_LABELS_AR.NONE,
      signals: [],
      primaryReason: null,
      primary_reason: null,
      recommendedAction: null,
      recommended_action_ar: null,
      evaluatedAt: now.toISOString(),
      explanations_ar: [],
    };
  }

  if (app.status !== 'approved') {
    return {
      riskLevel: RISK_LEVELS.NONE,
      risk_level: RISK_LEVELS.NONE,
      risk_level_label_ar: LEVEL_LABELS_AR.NONE,
      signals: [],
      primaryReason: null,
      primary_reason: null,
      recommendedAction: null,
      recommended_action_ar: null,
      evaluatedAt: now.toISOString(),
      explanations_ar: [],
    };
  }

  const minAttendance =
    attendance.minimumPercentage != null ? Number(attendance.minimumPercentage) : null;
  const attendancePct =
    attendance.percentage != null ? Number(attendance.percentage) : null;
  if (
    attendancePct != null &&
    minAttendance != null &&
    attendancePct < minAttendance
  ) {
    pushSignal(
      signals,
      RISK_SIGNALS.LOW_ATTENDANCE,
      `نسبة الحضور ${attendancePct}% أقل من الحد ${minAttendance}%`,
      3
    );
  } else if ((attendance.absentCount || 0) >= 2) {
    pushSignal(
      signals,
      RISK_SIGNALS.LOW_ATTENDANCE,
      `غاب عن ${attendance.absentCount} جلسات`,
      3
    );
  }

  const finalScore = qualification?.finalScore != null ? Number(qualification.finalScore) : null;
  const passing = qualification?.passingScore != null ? Number(qualification.passingScore) : 80;
  if (finalScore != null && finalScore < passing - 10) {
    pushSignal(
      signals,
      RISK_SIGNALS.LOW_SCORE,
      `الدرجة ${finalScore} / 100 بعيدة عن الحد ${passing}`,
      3
    );
  } else if (finalScore != null && finalScore < passing) {
    pushSignal(
      signals,
      RISK_SIGNALS.LOW_SCORE,
      `الدرجة ${finalScore} / 100 أقل من الحد ${passing}`,
      2
    );
  }

  if ((readiness.reasons || []).includes(READINESS_REASONS.POST_NOT_COMPLETED)) {
    pushSignal(signals, RISK_SIGNALS.MISSING_POST, 'لم يُكمل الاختبار البعدي', 2);
  }

  if (overdueTasks.length >= 1) {
    pushSignal(
      signals,
      RISK_SIGNALS.TASKS_OVERDUE,
      overdueTasks.length === 1
        ? 'مهمة واحدة متأخرة'
        : `${overdueTasks.length} مهام متأخرة`,
      overdueTasks.length >= 2 ? 3 : 2
    );
  }

  const pendingRequired = Number(input.pendingRequiredTasksCount || 0);
  if (pendingRequired >= 2) {
    pushSignal(
      signals,
      RISK_SIGNALS.MULTIPLE_TASKS_PENDING,
      `${pendingRequired} مهام مطلوبة معلّقة`,
      2
    );
  }

  if ((readiness.reasons || []).includes(READINESS_REASONS.BEHAVIOR_PENDING)) {
    pushSignal(signals, RISK_SIGNALS.BEHAVIOR_REVIEW_REQUIRED, 'بانتظار التقييم السلوكي', 1);
    pushSignal(signals, RISK_SIGNALS.EVALUATION_PENDING, 'تقييم معلّق', 1);
  }

  const expected = input.expectedHoursProgress;
  if (
    expected?.supported &&
    expected.expected != null &&
    expected.completed != null &&
    Number(expected.completed) + 0.5 < Number(expected.expected)
  ) {
    pushSignal(
      signals,
      RISK_SIGNALS.HOURS_BEHIND_EXPECTED,
      `الساعات المكتملة ${expected.completed} خلف المتوقع ${expected.expected}`,
      2
    );
  }

  const lectureAvailableDays = 3;
  for (const lecture of lectures) {
    if (lecture.completed_at) continue;
    const availableAt = lecture.available_at || lecture.published_at || lecture.created_at;
    const ageDays = daysBetween(availableAt, now);
    const progress = Number(lecture.progress_percent || 0);
    if (ageDays != null && ageDays >= lectureAvailableDays && progress <= 0) {
      pushSignal(
        signals,
        RISK_SIGNALS.RECORDED_LECTURE_NOT_STARTED,
        `لم يبدأ المحاضرة المسجلة منذ ${ageDays} أيام`,
        2
      );
      break;
    }
  }
  for (const lecture of lectures) {
    if (lecture.completed_at) continue;
    const progress = Number(lecture.progress_percent || 0);
    if (progress > 0 && progress < 100) {
      const availableAt = lecture.available_at || lecture.published_at || lecture.created_at;
      const ageDays = daysBetween(availableAt, now);
      if (ageDays != null && ageDays >= lectureAvailableDays) {
        pushSignal(
          signals,
          RISK_SIGNALS.RECORDED_LECTURE_INCOMPLETE,
          `محاضرة مسجلة غير مكتملة (${Math.round(progress)}%)`,
          1
        );
        break;
      }
    }
  }

  const inactiveDays = daysBetween(input.lastMeaningfulActivityAt, now);
  if (
    inactiveDays != null &&
    inactiveDays >= 8 &&
    ['in_training', 'task_pending', 'task_submitted', 'post_assessment_pending'].includes(
      app.training_status
    )
  ) {
    pushSignal(
      signals,
      RISK_SIGNALS.NO_RECENT_ACTIVITY,
      `آخر نشاط تدريبي منذ ${inactiveDays} أيام`,
      2
    );
  }

  if (
    readiness.state === READINESS_STATES.NOT_READY &&
    (readiness.reasons || []).filter((r) => r !== READINESS_REASONS.TRAINING_NOT_STARTED).length >= 2
  ) {
    pushSignal(signals, RISK_SIGNALS.COMPLETION_BLOCKED, 'عدة متطلبات تعيق الإكمال', 2);
  }

  const weight = signals.reduce((sum, s) => sum + (s.weight || 1), 0);
  let riskLevel = RISK_LEVELS.NONE;
  if (weight >= 8 || (attendance.absentCount || 0) >= 4) riskLevel = RISK_LEVELS.CRITICAL;
  else if (weight >= 5) riskLevel = RISK_LEVELS.HIGH;
  else if (weight >= 3) riskLevel = RISK_LEVELS.MEDIUM;
  else if (weight >= 1) riskLevel = RISK_LEVELS.LOW;

  // Healthy progressing students stay NONE even with soft noise.
  if (
    readiness.state === READINESS_STATES.READY ||
    readiness.state === READINESS_STATES.COMPLETED
  ) {
    if (riskLevel === RISK_LEVELS.LOW && !overdueTasks.length) {
      riskLevel = RISK_LEVELS.NONE;
      signals.length = 0;
    }
  }

  const primary = signals.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0] || null;
  const recommended = recommendAction(signals, readiness);

  return {
    riskLevel,
    risk_level: riskLevel,
    risk_level_label_ar: LEVEL_LABELS_AR[riskLevel],
    signals,
    primaryReason: primary?.code || null,
    primary_reason: primary?.code || null,
    primary_reason_label_ar: primary?.detail_ar || null,
    recommendedAction: recommended?.key || null,
    recommended_action_ar: recommended?.label_ar || null,
    evaluatedAt: now.toISOString(),
    explanations_ar: signals.map((s) => s.detail_ar),
  };
}

function recommendAction(signals, readiness) {
  const codes = new Set(signals.map((s) => s.code));
  if (codes.has(RISK_SIGNALS.TASKS_OVERDUE)) {
    return { key: 'review_overdue_tasks', label_ar: 'راجع المهام المتأخرة' };
  }
  if (codes.has(RISK_SIGNALS.LOW_ATTENDANCE)) {
    return { key: 'review_attendance', label_ar: 'راجع الحضور' };
  }
  if (codes.has(RISK_SIGNALS.MISSING_POST)) {
    return { key: 'remind_post', label_ar: 'ذكّر بإكمال POST' };
  }
  if (codes.has(RISK_SIGNALS.RECORDED_LECTURE_NOT_STARTED) || codes.has(RISK_SIGNALS.RECORDED_LECTURE_INCOMPLETE)) {
    return { key: 'follow_lecture', label_ar: 'تابع تقدم المحاضرة المسجلة' };
  }
  if (codes.has(RISK_SIGNALS.BEHAVIOR_REVIEW_REQUIRED)) {
    return { key: 'complete_behavior', label_ar: 'أكمل التقييم السلوكي' };
  }
  if (readiness?.state === READINESS_STATES.NEARLY_READY) {
    return { key: 'clear_remaining_blocker', label_ar: 'أغلق المتطلب المتبقي' };
  }
  if (signals.length) return { key: 'open_student', label_ar: 'عرض ملف الطالب' };
  return null;
}

module.exports = {
  RISK_LEVELS,
  RISK_SIGNALS,
  SIGNAL_LABELS_AR,
  LEVEL_LABELS_AR,
  evaluateFieldTrainingRisk,
};
