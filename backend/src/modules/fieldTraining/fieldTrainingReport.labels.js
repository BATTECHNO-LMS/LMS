'use strict';

const APPLICATION_STATUS_AR = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
};

const TRAINING_STATUS_AR = {
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
};

const OPPORTUNITY_STATUS_AR = {
  draft: 'مسودة',
  published: 'منشورة',
  in_progress: 'قيد التنفيذ',
  archived: 'مغلقة',
};

const ATTENDANCE_STATUS_AR = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'معذور',
  unconfirmed: 'غير مؤكد',
};

const ATTENDANCE_METHOD_AR = {
  electronic: 'إلكتروني',
  manual: 'يدوي',
  auto_finalize: 'إغلاق تلقائي',
  bulk_manual: 'تسجيل جماعي',
};

const TASK_REVIEW_AR = {
  pending: 'لم يُسلَّم',
  submitted: 'مُسلَّم',
  under_review: 'قيد المراجعة',
  needs_revision: 'يحتاج تعديلاً',
  approved: 'مقبول',
  rejected: 'مرفوض',
  graded: 'مُقيَّم',
};

const ELIGIBILITY_AR = {
  pending: 'بانتظار التقييم',
  eligible: 'مؤهل',
  ineligible: 'غير مؤهل',
  not_eligible: 'غير مؤهل',
  needs_review: 'يحتاج مراجعة',
};

const CERTIFICATE_AR = {
  issued: 'صادرة',
  not_issued: 'لم تصدر',
  revoked: 'ملغاة',
  pending: 'بانتظار الإصدار',
  not_eligible: 'غير مستوفٍ لشروط الشهادة',
};

const REASON_AR = {
  attendance_below_minimum: 'الحضور دون الحد الأدنى',
  training_hours_incomplete: 'الساعات التدريبية غير مكتملة',
  post_assessment_missing: 'الاختبار البعدي غير مكتمل',
  post_assessment_below_minimum: 'درجة الاختبار البعدي دون الحد الأدنى',
  final_task_not_submitted: 'المهمة النهائية غير مسلمة',
  final_task_rejected: 'المهمة النهائية مرفوضة',
  final_task_pending_review: 'المهمة النهائية بانتظار التقييم',
  expelled: 'مستبعد من التدريب',
  failed: 'حالة تدريب غير مكتملة',
};

function labelOf(map, value, fallback = '—') {
  if (value == null || value === '') return fallback;
  return map[value] || String(value);
}

module.exports = {
  APPLICATION_STATUS_AR,
  TRAINING_STATUS_AR,
  OPPORTUNITY_STATUS_AR,
  ATTENDANCE_STATUS_AR,
  ATTENDANCE_METHOD_AR,
  TASK_REVIEW_AR,
  ELIGIBILITY_AR,
  CERTIFICATE_AR,
  REASON_AR,
  labelOf,
};
