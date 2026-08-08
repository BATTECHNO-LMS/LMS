'use strict';

/**
 * Shared pure metric helpers for institutional training reports.
 * Official report values must be computed here (or via builders that call these),
 * never re-derived ad-hoc in the frontend.
 */

const REPORT_TYPES = Object.freeze({
  INDIVIDUAL: 'INDIVIDUAL',
  COURSE: 'COURSE',
  COHORT: 'COHORT',
  TRAINER: 'TRAINER',
  EVALUATION: 'EVALUATION',
  ATTENDANCE: 'ATTENDANCE',
  LEARNING_IMPACT: 'LEARNING_IMPACT',
  CERTIFICATES: 'CERTIFICATES',
});

const REPORT_TYPE_TITLES_AR = Object.freeze({
  INDIVIDUAL: 'التقرير الفردي لنتائج المتدرب',
  COURSE: 'التقرير الشامل للدورة التدريبية',
  COHORT: 'تقرير الدفعة التدريبية',
  TRAINER: 'تقرير أداء المدرب',
  EVALUATION: 'تقرير التقييم النهائي للدورة',
  ATTENDANCE: 'تقرير الحضور والساعات التدريبية',
  LEARNING_IMPACT: 'تقرير قياس أثر التعلّم',
  CERTIFICATES: 'تقرير الإكمال والشهادات',
});

const REPORT_STATUS = Object.freeze({
  NOT_GENERATED: 'NOT_GENERATED',
  QUEUED: 'QUEUED',
  GENERATING: 'GENERATING',
  READY: 'READY',
  FAILED: 'FAILED',
  STALE: 'STALE',
  REGENERATING: 'REGENERATING',
});

const NA = Object.freeze({
  UNAVAILABLE: 'غير متوفر',
  NOT_RECORDED: 'لم يُسجل',
  NOT_REQUIRED: 'غير مطلوب',
  PENDING_REVIEW: 'بانتظار التصحيح',
});

const PRESENT_LIKE = new Set(['present', 'late', 'excused']);

function round2(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

function average(values) {
  const nums = (values || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!nums.length) return null;
  return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function median(values) {
  const nums = (values || []).filter((v) => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) return round2((nums[mid - 1] + nums[mid]) / 2);
  return nums[mid];
}

function stdDev(values) {
  const nums = (values || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (nums.length - 1);
  return round2(Math.sqrt(variance));
}

function pct(part, total) {
  if (total == null || total === 0) return null;
  return round2((part / total) * 100);
}

/**
 * Attendance breakdown from session list + attendance records.
 * When no sessions exist, percentage fields are null (not 0).
 */
function computeAttendanceBreakdown(sessions, attendanceRecords) {
  const sessionCount = (sessions || []).length;
  const records = attendanceRecords || [];
  const byStatus = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unconfirmed: 0,
  };
  for (const r of records) {
    const s = String(r.status || '').toLowerCase();
    if (s === 'present') byStatus.present += 1;
    else if (s === 'absent') byStatus.absent += 1;
    else if (s === 'late') byStatus.late += 1;
    else if (s === 'excused') byStatus.excused += 1;
    else byStatus.unconfirmed += 1;
  }
  const presentLike = records.filter((r) => PRESENT_LIKE.has(String(r.status || '').toLowerCase()));
  const attendancePct = sessionCount ? pct(presentLike.length, sessionCount) : null;
  const hoursCompleted = presentLike.reduce((sum, a) => {
    const session = (sessions || []).find((s) => s.id === a.session_id);
    return sum + Number(session?.hours || 0);
  }, 0);
  const hoursDelivered = (sessions || []).reduce((sum, s) => sum + Number(s.hours || 0), 0);

  return {
    totalSessions: sessionCount,
    present: byStatus.present,
    absent: byStatus.absent,
    late: byStatus.late,
    excused: byStatus.excused,
    unconfirmed: byStatus.unconfirmed,
    attendedSessions: presentLike.length,
    attendancePct,
    hoursCompleted: round2(hoursCompleted),
    hoursDelivered: round2(hoursDelivered),
    attendancePctLabel: attendancePct == null ? NA.UNAVAILABLE : `${attendancePct}%`,
  };
}

/**
 * Percentage-point difference and relative improvement.
 * relative = ((post - pre) / pre) * 100 when pre > 0; null when pre is 0 or missing.
 */
function computeImprovement(preScore, postScore) {
  const pre = preScore == null ? null : Number(preScore);
  const post = postScore == null ? null : Number(postScore);
  if (pre == null || post == null || Number.isNaN(pre) || Number.isNaN(post)) {
    return {
      preTestScore: pre,
      postTestScore: post,
      percentagePointDifference: null,
      relativeImprovementPct: null,
      direction: 'unavailable',
      note:
        'فرق النقاط المئوية = البعدي − القبلي. التحسن النسبي = (البعدي − القبلي) / القبلي × 100 عند وجود درجة قبلية أكبر من صفر.',
    };
  }
  const pp = round2(post - pre);
  const relative = pre > 0 ? round2(((post - pre) / pre) * 100) : null;
  let direction = 'unchanged';
  if (pp > 0) direction = 'improved';
  else if (pp < 0) direction = 'decreased';
  return {
    preTestScore: pre,
    postTestScore: post,
    percentagePointDifference: pp,
    relativeImprovementPct: relative,
    direction,
    note:
      'فرق النقاط المئوية يقيس الفرق المطلق بين النسبتين (مثلاً من 55% إلى 85% = +30 نقطة مئوية). التحسن النسبي يقيس النسبة إلى الدرجة القبلية وليس هو نفسه فرق النقاط المئوية.',
  };
}

/**
 * NPS = %Promoters − %Detractors. Not an average score.
 * Promoters 9–10, Passives 7–8, Detractors 0–6.
 */
function computeNps(scores) {
  const nums = (scores || [])
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v) && v >= 0 && v <= 10);
  const total = nums.length;
  if (!total) {
    return {
      promoters: 0,
      passives: 0,
      detractors: 0,
      promotersPct: null,
      passivesPct: null,
      detractorsPct: null,
      index: null,
      totalResponses: 0,
      note: 'NPS = نسبة المروّجين − نسبة المنتقدين. لا يُحسب كمتوسط درجات.',
    };
  }
  const promoters = nums.filter((v) => v >= 9).length;
  const passives = nums.filter((v) => v >= 7 && v <= 8).length;
  const detractors = nums.filter((v) => v <= 6).length;
  return {
    promoters,
    passives,
    detractors,
    promotersPct: pct(promoters, total),
    passivesPct: pct(passives, total),
    detractorsPct: pct(detractors, total),
    index: round2(((promoters - detractors) / total) * 100),
    totalResponses: total,
    note: 'NPS = نسبة المروّجين − نسبة المنتقدين. لا يُحسب كمتوسط درجات.',
  };
}

function summarizeNumeric(values) {
  const nums = (values || []).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!nums.length) {
    return {
      count: 0,
      average: null,
      median: null,
      min: null,
      max: null,
      stdDev: null,
    };
  }
  return {
    count: nums.length,
    average: average(nums),
    median: median(nums),
    min: Math.min(...nums),
    max: Math.max(...nums),
    stdDev: stdDev(nums),
  };
}

function buildEnrollmentFunnel(enrollments) {
  const list = enrollments || [];
  const countStatus = (...statuses) => list.filter((e) => statuses.includes(e.status)).length;
  const stages = [
    { key: 'registered', label: 'مسجّل', count: list.length },
    { key: 'pending', label: 'قيد الانتظار', count: countStatus('PENDING', 'INVITED') },
    { key: 'approved', label: 'معتمد', count: countStatus('APPROVED', 'ACTIVE', 'REQUIREMENTS_COMPLETED', 'COMPLETED') },
    { key: 'active', label: 'نشط', count: countStatus('ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED') },
    { key: 'completed', label: 'مكتمل', count: countStatus('COMPLETED') },
    { key: 'notCompleted', label: 'غير مكتمل', count: countStatus('NOT_COMPLETED') },
    { key: 'withdrawn', label: 'منسحب', count: countStatus('WITHDRAWN') },
  ];
  return stages.map((stage, idx) => {
    const prev = idx === 0 ? stage.count : stages[idx - 1].count;
    return {
      ...stage,
      percentageOfTotal: pct(stage.count, list.length),
      conversionFromPrevious: prev ? pct(stage.count, prev) : null,
    };
  });
}

/**
 * Rules-based individual recommendation text. Deterministic; no unsupported praise.
 */
function buildIndividualRecommendation({
  improvement,
  attendancePct,
  completedAllRequirements,
  certificateIssued,
  missingRequirements,
}) {
  const parts = [];
  if (improvement?.direction === 'improved' && improvement.percentagePointDifference != null) {
    parts.push(
      `حقق المتدرب تحسنًا قدره ${improvement.percentagePointDifference} نقطة مئوية بين الاختبار القبلي والبعدي`
    );
  } else if (improvement?.direction === 'decreased') {
    parts.push('انخفض أداء المتدرب في الاختبار البعدي مقارنة بالقبلي');
  } else if (improvement?.direction === 'unchanged') {
    parts.push('حافظ المتدرب على نفس مستوى الأداء بين الاختبارين');
  }

  if (attendancePct != null) {
    parts.push(`وبلغت نسبة حضوره ${attendancePct}%`);
  }

  if (completedAllRequirements) {
    parts.push('واستوفى جميع متطلبات الإكمال');
    if (certificateIssued) parts.push('وصدرت له الشهادة');
  } else {
    const missing = (missingRequirements || []).filter(Boolean);
    if (missing.length) {
      parts.push(`ولذلك لم يكتمل التدريب بسبب: ${missing.join('، ')}`);
    } else {
      parts.push('ولذلك لم يكتمل التدريب ولم تصدر الشهادة');
    }
  }

  if (!parts.length) return 'لا تتوفر بيانات كافية لصياغة توصية.';
  return `${parts.join('، ')}.`;
}

function privacySafeGroup(count, minSize = 5) {
  if (count == null) return false;
  return Number(count) >= minSize;
}

function buildScopeKey({ cohortId, enrollmentId, trainerUserId } = {}) {
  return [
    cohortId || 'none',
    enrollmentId || 'none',
    trainerUserId || 'none',
  ].join('|');
}

module.exports = {
  REPORT_TYPES,
  REPORT_TYPE_TITLES_AR,
  REPORT_STATUS,
  NA,
  PRESENT_LIKE,
  round2,
  average,
  median,
  stdDev,
  pct,
  computeAttendanceBreakdown,
  computeImprovement,
  computeNps,
  summarizeNumeric,
  buildEnrollmentFunnel,
  buildIndividualRecommendation,
  privacySafeGroup,
  buildScopeKey,
};
