'use strict';

/**
 * Translate Field Training / account audit events into human-readable Arabic.
 * Never exposes raw codes as the default user-facing title.
 */

const CATEGORY = Object.freeze({
  ACCOUNT: 'ACCOUNT',
  ATTENDANCE: 'ATTENDANCE',
  TASKS: 'TASKS',
  ASSESSMENTS: 'ASSESSMENTS',
  TRAINING: 'TRAINING',
  ELIGIBILITY: 'ELIGIBILITY',
  REPORTS: 'REPORTS',
});

const CATEGORY_LABEL_AR = Object.freeze({
  ACCOUNT: 'الدخول والحساب',
  ATTENDANCE: 'الحضور',
  TASKS: 'التاسكات',
  ASSESSMENTS: 'التقييمات',
  TRAINING: 'التدريب',
  ELIGIBILITY: 'الأهلية',
  REPORTS: 'التقارير',
});

function text(value) {
  if (value == null) return '';
  const s = String(value).trim();
  return s && s !== 'null' && s !== 'undefined' ? s : '';
}

function fromNewValues(event, keys = []) {
  const nv = event?.new_values || event?.newValues || {};
  for (const key of keys) {
    const v = text(nv[key]);
    if (v) return v;
  }
  return '';
}

function translateStudentActivityEvent(event = {}) {
  const action = String(event.action_type || event.actionType || '').trim();
  const taskTitle = fromNewValues(event, ['taskTitle', 'task_title', 'title']);
  const sessionTitle = fromNewValues(event, ['sessionTitle', 'session_title', 'title']);
  const score = fromNewValues(event, ['score', 'post_assessment_score', 'pre_assessment_score']);

  const map = {
    USER_LOGIN_SUCCESS: {
      title: 'تسجيل الدخول',
      description: 'سجّل الطالب الدخول إلى المنصة',
      category: CATEGORY.ACCOUNT,
    },
    FIELD_TRAINING_SUBMISSION_REVIEWED: {
      title: 'تقييم مهمة',
      description: taskTitle
        ? `تم تقييم المهمة: ${taskTitle}`
        : 'تم تقييم إحدى مهام التدريب الميداني',
      category: CATEGORY.TASKS,
    },
    FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE: {
      title: 'تحديث الحضور',
      description: sessionTitle
        ? `تم تحديث حالة حضور الطالب في جلسة ${sessionTitle}`
        : 'تم تحديث سجل حضور الطالب',
      category: CATEGORY.ATTENDANCE,
    },
    FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM: {
      title: 'تأكيد الحضور الإلكتروني',
      description: sessionTitle
        ? `أكّد الطالب حضوره إلكترونيًا في جلسة ${sessionTitle}`
        : 'أكّد الطالب حضوره إلكترونيًا',
      category: CATEGORY.ATTENDANCE,
    },
    FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT: {
      title: 'تسجيل غياب',
      description: sessionTitle
        ? `تم تسجيل الطالب غائبًا في جلسة ${sessionTitle}`
        : 'تم تسجيل غياب الطالب في إحدى الجلسات',
      category: CATEGORY.ATTENDANCE,
    },
    FIELD_TRAINING_ATTENDANCE_MARK_ALL_PRESENT: {
      title: 'تسجيل حضور جماعي',
      description: 'تم تسجيل حضور جماعي للجلسة',
      category: CATEGORY.ATTENDANCE,
    },
    FIELD_TRAINING_ASSESSMENT_PUBLISHED: {
      title: 'نشر تقييم',
      description: 'تم نشر تقييم مرتبط بالتدريب الميداني',
      category: CATEGORY.ASSESSMENTS,
    },
    FIELD_TRAINING_STARTED: {
      title: 'بدء التدريب',
      description: 'بدأ مسار التدريب الميداني للطالب',
      category: CATEGORY.TRAINING,
    },
    FIELD_TRAINING_APPLICATION_APPROVED: {
      title: 'قبول الطلب',
      description: 'تم قبول طلب الطالب في فرصة التدريب الميداني',
      category: CATEGORY.TRAINING,
    },
    FIELD_TRAINING_APPLICATION_REJECTED: {
      title: 'رفض الطلب',
      description: 'تم رفض طلب الطالب في فرصة التدريب الميداني',
      category: CATEGORY.TRAINING,
    },
    FIELD_TRAINING_PARTICIPANT_EXPELLED: {
      title: 'استبعاد من التدريب',
      description: 'تم استبعاد الطالب من التدريب الميداني',
      category: CATEGORY.TRAINING,
    },
    'field_training.hours.update': {
      title: 'تحديث الساعات',
      description: 'تم تحديث الساعات التدريبية المنجزة للطالب',
      category: CATEGORY.TRAINING,
    },
    FIELD_TRAINING_ELIGIBILITY_RECALCULATED: {
      title: 'تحديث الأهلية',
      description: 'تم تحديث حالة أهلية الطالب',
      category: CATEGORY.ELIGIBILITY,
    },
    FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1: {
      title: 'تحديث الأهلية',
      description: 'تم تحديث أهلية الطالب ضمن مسار الساعات التدريبية',
      category: CATEGORY.ELIGIBILITY,
    },
    FIELD_TRAINING_COMPLETION_LETTER_ISSUED: {
      title: 'إصدار كتاب الإنهاء',
      description: 'تم إصدار كتاب إنهاء التدريب الميداني',
      category: CATEGORY.REPORTS,
    },
    FIELD_TRAINING_COMPLETION_LETTER_REGENERATED: {
      title: 'إعادة إصدار كتاب الإنهاء',
      description: 'تم إعادة إنشاء كتاب إنهاء التدريب الميداني',
      category: CATEGORY.REPORTS,
    },
    FT_EVAL_REPORT_GENERATED: {
      title: 'إنشاء تقرير تقييم',
      description: 'تم إنشاء تقرير التقييم النهائي',
      category: CATEGORY.REPORTS,
    },
    FT_EVAL_REPORT_REGENERATED: {
      title: 'إعادة إنشاء تقرير تقييم',
      description: 'تم إعادة إنشاء تقرير التقييم النهائي',
      category: CATEGORY.REPORTS,
    },
    FT_EVAL_MANUAL_RATING_SAVED: {
      title: 'تقييم سلوكي',
      description: 'تم حفظ تقييم المشرف للمعايير المهنية',
      category: CATEGORY.ELIGIBILITY,
    },
  };

  const known = map[action];
  if (known) {
    let description = known.description;
    if (action === 'USER_LOGIN_SUCCESS') {
      description = 'سجّل الطالب الدخول إلى المنصة';
    }
    if (score && (action.includes('ASSESSMENT') || action.includes('EVAL'))) {
      description = `${description}${description.endsWith('.') ? '' : ''} (${score})`;
    }
    return {
      title: known.title,
      description,
      category: known.category,
      categoryLabelAr: CATEGORY_LABEL_AR[known.category],
      actionType: action,
    };
  }

  return {
    title: 'نشاط على المنصة',
    description: 'حدث نشاط مرتبط بحساب الطالب أو تدريبه الميداني',
    category: CATEGORY.TRAINING,
    categoryLabelAr: CATEGORY_LABEL_AR.TRAINING,
    actionType: action || null,
  };
}

const LOGIN_ACTION = 'USER_LOGIN_SUCCESS';

const STUDENT_ACTIVITY_ACTIONS = Object.freeze([
  LOGIN_ACTION,
  'FIELD_TRAINING_SUBMISSION_REVIEWED',
  'FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE',
  'FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM',
  'FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT',
  'FIELD_TRAINING_ATTENDANCE_MARK_ALL_PRESENT',
  'FIELD_TRAINING_ASSESSMENT_PUBLISHED',
  'FIELD_TRAINING_STARTED',
  'FIELD_TRAINING_APPLICATION_APPROVED',
  'FIELD_TRAINING_APPLICATION_REJECTED',
  'FIELD_TRAINING_PARTICIPANT_EXPELLED',
  'field_training.hours.update',
  'FIELD_TRAINING_ELIGIBILITY_RECALCULATED',
  'FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1',
  'FIELD_TRAINING_COMPLETION_LETTER_ISSUED',
  'FIELD_TRAINING_COMPLETION_LETTER_REGENERATED',
  'FT_EVAL_REPORT_GENERATED',
  'FT_EVAL_REPORT_REGENERATED',
  'FT_EVAL_MANUAL_RATING_SAVED',
]);

module.exports = {
  CATEGORY,
  CATEGORY_LABEL_AR,
  LOGIN_ACTION,
  STUDENT_ACTIVITY_ACTIONS,
  translateStudentActivityEvent,
};
