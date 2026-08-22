'use strict';

/**
 * Canonical field-training report calculations.
 * Missing values stay null — never coerced to zero for official rates.
 */

const NA = 'غير متوفر';
const NOT_RECORDED = 'لم يسجل';
const NOT_REQUIRED = 'غير مطلوب';
const PENDING_EVAL = 'بانتظار التقييم';

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value) {
  const n = toNumber(value);
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

function numericList(values) {
  return (values || []).map(toNumber).filter((n) => n != null);
}

function average(values) {
  const list = numericList(values);
  if (!list.length) return null;
  return round2(list.reduce((sum, n) => sum + n, 0) / list.length);
}

function median(values) {
  const list = numericList(values).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  if (list.length % 2 === 0) return round2((list[mid - 1] + list[mid]) / 2);
  return round2(list[mid]);
}

function minOf(values) {
  const list = numericList(values);
  if (!list.length) return null;
  return round2(Math.min(...list));
}

function maxOf(values) {
  const list = numericList(values);
  if (!list.length) return null;
  return round2(Math.max(...list));
}

function sum(values) {
  const list = numericList(values);
  if (!list.length) return null;
  return round2(list.reduce((acc, n) => acc + n, 0));
}

function rate(numerator, denominator) {
  const n = toNumber(numerator);
  const d = toNumber(denominator);
  if (n == null || d == null || d <= 0) return null;
  return round2((n / d) * 100);
}

function percentageOf(part, total) {
  return rate(part, total);
}

function displayMetric(value, { kind = 'number', missing = NA } = {}) {
  if (value == null || value === '') return missing;
  if (kind === 'percent') return `${round2(value)}%`;
  if (kind === 'pp') {
    const n = round2(value);
    if (n == null) return missing;
    return `${n > 0 ? '+' : ''}${n} نقطة مئوية`;
  }
  if (typeof value === 'number') return String(round2(value));
  return String(value);
}

function progressBucket(pct) {
  const n = toNumber(pct);
  if (n == null) return null;
  if (n >= 100) return '100';
  if (n >= 75) return '75-99';
  if (n >= 50) return '50-74';
  if (n >= 25) return '25-49';
  return '0-24';
}

const PROGRESS_BUCKET_ORDER = ['0-24', '25-49', '50-74', '75-99', '100'];
const PROGRESS_BUCKET_LABELS = {
  '0-24': '0–24%',
  '25-49': '25–49%',
  '50-74': '50–74%',
  '75-99': '75–99%',
  '100': '100%',
};

function progressDistribution(percentages) {
  const counts = Object.fromEntries(PROGRESS_BUCKET_ORDER.map((k) => [k, 0]));
  let known = 0;
  let missing = 0;
  for (const value of percentages || []) {
    const bucket = progressBucket(value);
    if (!bucket) {
      missing += 1;
      continue;
    }
    counts[bucket] += 1;
    known += 1;
  }
  return {
    known,
    missing,
    buckets: PROGRESS_BUCKET_ORDER.map((key) => ({
      key,
      label: PROGRESS_BUCKET_LABELS[key],
      count: counts[key],
      percentage: percentageOf(counts[key], known),
    })),
  };
}

function conversionRate(fromCount, toCount) {
  return rate(toCount, fromCount);
}

/**
 * @param {Array<{ key: string, label: string, count: number }>} stages
 */
function withConversions(stages) {
  return stages.map((stage, index) => {
    const prev = index > 0 ? stages[index - 1] : null;
    return {
      ...stage,
      percentage_of_total: percentageOf(stage.count, stages[0]?.count),
      conversion_from_previous: prev ? conversionRate(prev.count, stage.count) : null,
    };
  });
}

function prePostDelta(pre, post) {
  const a = toNumber(pre);
  const b = toNumber(post);
  if (a == null || b == null) return null;
  return round2(b - a);
}

function relativeImprovement(pre, post) {
  const a = toNumber(pre);
  const b = toNumber(post);
  if (a == null || b == null || a === 0) return null;
  return round2(((b - a) / Math.abs(a)) * 100);
}

function classifyPrePost(pre, post) {
  const delta = prePostDelta(pre, post);
  if (delta == null) return null;
  if (delta > 0) return 'improved';
  if (delta < 0) return 'decreased';
  return 'unchanged';
}

function summarizePrePostPairs(pairs) {
  const usable = (pairs || []).filter((p) => toNumber(p.pre) != null && toNumber(p.post) != null);
  if (!usable.length) {
    return {
      sample_size: 0,
      average_pre: null,
      average_post: null,
      average_pp: null,
      improved: 0,
      unchanged: 0,
      decreased: 0,
      improved_pct: null,
      unchanged_pct: null,
      decreased_pct: null,
      observation: 'لا توجد نتائج قبلية وبعدية مكتملة ضمن نطاق التقرير.',
    };
  }
  const improved = usable.filter((p) => classifyPrePost(p.pre, p.post) === 'improved').length;
  const unchanged = usable.filter((p) => classifyPrePost(p.pre, p.post) === 'unchanged').length;
  const decreased = usable.filter((p) => classifyPrePost(p.pre, p.post) === 'decreased').length;
  return {
    sample_size: usable.length,
    average_pre: average(usable.map((p) => p.pre)),
    average_post: average(usable.map((p) => p.post)),
    average_pp: average(usable.map((p) => prePostDelta(p.pre, p.post))),
    improved,
    unchanged,
    decreased,
    improved_pct: percentageOf(improved, usable.length),
    unchanged_pct: percentageOf(unchanged, usable.length),
    decreased_pct: percentageOf(decreased, usable.length),
    observation: 'الفرق الملحوظ بين نتائج القياس القبلي والبعدي',
    caveat: 'لا يُفسَّر الفرق على أنه أثر سببي للتدريب.',
  };
}

const ATTENDED_STATUSES = new Set(['present', 'late', 'excused']);

function countAttendanceStatuses(rows) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0, unconfirmed: 0, other: 0 };
  for (const row of rows || []) {
    const status = row?.status || row;
    if (status === 'present') counts.present += 1;
    else if (status === 'absent') counts.absent += 1;
    else if (status === 'late') counts.late += 1;
    else if (status === 'excused') counts.excused += 1;
    else if (status === 'unconfirmed') counts.unconfirmed += 1;
    else counts.other += 1;
  }
  return counts;
}

function isAttendedStatus(status) {
  return ATTENDED_STATUSES.has(status);
}

function requirementState({ required, complete, pending = false }) {
  if (!required) return 'not_required';
  if (pending) return 'pending';
  if (complete == null) return 'incomplete';
  return complete ? 'complete' : 'incomplete';
}

const REQUIREMENT_LABELS = {
  complete: 'مكتمل',
  incomplete: 'غير مكتمل',
  pending: 'بانتظار التقييم',
  not_required: 'غير مطلوب',
};

function requirementLabel(state) {
  return REQUIREMENT_LABELS[state] || NA;
}

function buildUniversityRecommendations({
  specialtyAttendance = [],
  hoursBelow = 0,
  attendanceBelow = 0,
  pendingGrading = 0,
  atRisk = 0,
  completionRate = null,
  incompleteAttendanceRecords = 0,
}) {
  const rows = [];
  for (const spec of specialtyAttendance) {
    const below = toNumber(spec.below_threshold);
    const total = toNumber(spec.students);
    if (below != null && total != null && total > 0 && below / total >= 0.3) {
      rows.push({
        finding: `حضور منخفض في تخصص ${spec.label}`,
        evidence: `${below}/${total} طلاب دون الحد الأدنى`,
        priority: 'عالية',
        action: 'مراجعة الجدول والمتابعة الإدارية للحضور',
      });
    }
  }
  if (attendanceBelow > 0) {
    rows.push({
      finding: 'طلاب دون حد الحضور المطلوب',
      evidence: `${attendanceBelow} طالب`,
      priority: attendanceBelow >= 5 ? 'عالية' : 'متوسطة',
      action: 'متابعة الغياب وإعادة جدولة الجلسات عند الحاجة',
    });
  }
  if (hoursBelow > 0) {
    rows.push({
      finding: 'طلاب لم يستوفوا الساعات التدريبية المطلوبة',
      evidence: `${hoursBelow} طالب`,
      priority: 'عالية',
      action: 'مراجعة خطة الساعات وجلسات التعويض',
    });
  }
  if (pendingGrading > 0) {
    rows.push({
      finding: 'مهام بانتظار التقييم',
      evidence: `${pendingGrading} تسليم`,
      priority: 'متوسطة',
      action: 'إنهاء تقييم التسليمات المعلقة',
    });
  }
  if (atRisk > 0) {
    rows.push({
      finding: 'حالات تحتاج متابعة إدارية',
      evidence: `${atRisk} حالة`,
      priority: 'عالية',
      action: 'مراجعة قائمة الحالات المعلقة واتخاذ إجراء محدد',
    });
  }
  if (completionRate != null && completionRate < 50) {
    rows.push({
      finding: 'معدل إكمال منخفض ضمن نطاق التقرير',
      evidence: `معدل الإكمال ${completionRate}%`,
      priority: 'عالية',
      action: 'مراجعة متطلبات الإكمال والحواجز التشغيلية',
    });
  }
  if (incompleteAttendanceRecords > 0) {
    rows.push({
      finding: 'سجلات حضور غير مكتملة',
      evidence: `${incompleteAttendanceRecords} سجل`,
      priority: 'متوسطة',
      action: 'استكمال تسجيل الحضور قبل اعتماد النتائج',
    });
  }
  return rows;
}

function buildStudentRecommendations({
  completed,
  attendanceState,
  hoursState,
  tasksState,
  assessmentState,
  eligibilityStatus,
}) {
  if (completed) {
    return [{ key: 'completed', text: 'اكتملت متطلبات التدريب الميداني وفق السجلات المعتمدة.' }];
  }
  const rows = [];
  if (attendanceState === 'incomplete') {
    rows.push({ key: 'attendance', text: 'متطلب الحضور غير مكتمل.' });
  }
  if (hoursState === 'incomplete') {
    rows.push({ key: 'hours', text: 'الساعات التدريبية المطلوبة غير مكتملة.' });
  }
  if (tasksState === 'pending') {
    rows.push({ key: 'tasks_pending', text: 'يوجد تقييم مهام بانتظار الإكمال.' });
  } else if (tasksState === 'incomplete') {
    rows.push({ key: 'tasks', text: 'المهام المطلوبة غير مكتملة.' });
  }
  if (assessmentState === 'incomplete') {
    rows.push({ key: 'assessment', text: 'الاختبار البعدي غير مكتمل.' });
  }
  if (eligibilityStatus === 'needs_review') {
    rows.push({ key: 'review', text: 'الحالة بانتظار مراجعة إدارية.' });
  }
  if (!rows.length) {
    rows.push({ key: 'in_progress', text: 'التدريب الميداني ما زال قيد الإنجاز.' });
  }
  return rows;
}

module.exports = {
  NA,
  NOT_RECORDED,
  NOT_REQUIRED,
  PENDING_EVAL,
  toNumber,
  round2,
  average,
  median,
  minOf,
  maxOf,
  sum,
  rate,
  percentageOf,
  displayMetric,
  progressBucket,
  progressDistribution,
  PROGRESS_BUCKET_ORDER,
  PROGRESS_BUCKET_LABELS,
  conversionRate,
  withConversions,
  prePostDelta,
  relativeImprovement,
  classifyPrePost,
  summarizePrePostPairs,
  countAttendanceStatuses,
  isAttendedStatus,
  requirementState,
  requirementLabel,
  buildUniversityRecommendations,
  buildStudentRecommendations,
};
