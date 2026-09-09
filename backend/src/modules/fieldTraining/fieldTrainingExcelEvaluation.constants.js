'use strict';

const path = require('path');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UNAVAILABLE_AR = 'غير متوفر';
const NO_TASKS_AR = 'لا توجد مهام مسجلة في المنصة';
const ELIGIBLE_AR = 'مؤهل';
const NOT_ELIGIBLE_AR = 'غير مؤهل';
const EMPTY_TASKS_FALLBACK = NO_TASKS_AR;
const SHEET_NAME = 'Form Responses 1';
const TEMPLATE_VERSION_DEFAULT = 1;
const FALLBACK_VERSION = 'v1';

const SCORE_SOURCE = Object.freeze({
  REAL_SUPERVISOR_RATING: 'REAL_SUPERVISOR_RATING',
  PERFORMANCE_DERIVED: 'PERFORMANCE_DERIVED',
  ADMINISTRATIVE_FALLBACK_7_9: 'ADMINISTRATIVE_FALLBACK_7_9',
  NOT_ELIGIBLE_ZERO: 'NOT_ELIGIBLE_ZERO',
});

const CRITERIA = Object.freeze([
  { code: 'commitment', header: /التزام الطالب/ },
  { code: 'tasksOnTime', header: /إنجاز الطالب للمهام الموكولة له في وقتها/ },
  { code: 'taskQuality', header: /إنجاز المهام الموكولة للطالب بشكل صحيح/ },
  { code: 'learning', header: /التعلم وبناء مهارات/ },
  { code: 'cooperation', header: /تعاونا.? واحتراما/ },
  { code: 'teamwork', header: /تحمل المسؤولية والعمل بروح الفريق/ },
  { code: 'communication', header: /مهارات ملحوظة في التواصل/ },
  { code: 'problemSolving', header: /ابتكار حلول للمشكلات/ },
  { code: 'problemSolvingDuplicate', header: /ابتكار حلول للمشكلات/ },
]);

const EXCEL_REASON_LABELS_AR = Object.freeze({
  ATTENDANCE_BELOW_MINIMUM: 'نسبة الحضور أقل من الحد الأدنى المطلوب.',
  REQUIRED_HOURS_INCOMPLETE: 'لم يستكمل الساعات التدريبية المطلوبة.',
  REQUIRED_TASKS_INCOMPLETE: 'لم يستكمل التسليمات المطلوبة.',
  POST_ASSESSMENT_INCOMPLETE: 'لم يستكمل التقييم البعدي.',
  OTHER_EXISTING_ELIGIBILITY_RULE: 'لم يستوفِ متطلبات التدريب الميداني.',
});

const DEFAULT_TEMPLATE_PATH = path.join(
  __dirname,
  '../../../assets/field-training/tafila-field-training-excel-evaluation.xlsx'
);

const NEW_HEADERS = Object.freeze({
  university: 'الجامعة',
  status: 'الحالة',
  ineligibilityReason: 'سبب عدم التأهيل',
});

module.exports = {
  XLSX_MIME,
  UNAVAILABLE_AR,
  NO_TASKS_AR,
  EMPTY_TASKS_FALLBACK,
  ELIGIBLE_AR,
  NOT_ELIGIBLE_AR,
  SHEET_NAME,
  TEMPLATE_VERSION_DEFAULT,
  FALLBACK_VERSION,
  SCORE_SOURCE,
  CRITERIA,
  EXCEL_REASON_LABELS_AR,
  DEFAULT_TEMPLATE_PATH,
  NEW_HEADERS,
};
