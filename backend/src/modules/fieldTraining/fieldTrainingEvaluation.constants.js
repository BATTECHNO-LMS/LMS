'use strict';

const TEMPLATE_MISSING_CODE = 'FIELD_TRAINING_EVALUATION_TEMPLATE_MISSING';
const PROFESSIONAL_INCOMPLETE_CODE = 'PROFESSIONAL_EVALUATION_INCOMPLETE';
const DATA_INCOMPLETE_CODE = 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE';
const STUDENT_NUMBER_UNRESOLVED_CODE = 'STUDENT_NUMBER_UNRESOLVED';
const UNRESOLVED_PLACEHOLDERS_CODE = 'UNRESOLVED_PLACEHOLDERS';
const PDF_RENDER_FAILED_CODE = 'FIELD_TRAINING_TEMPLATE_RENDER_FAILED';
const TEMPLATE_FIDELITY_FAIL = 'TEMPLATE_FIDELITY_FAIL';
const TEMPLATE_FONT_UNAVAILABLE = 'TEMPLATE_FONT_UNAVAILABLE';
const READY_STATUS = 'READY';
const MISSING_REQUIRED_DATA = 'MISSING_REQUIRED_DATA';
const READY_AUTOMATIC = 'READY_AUTOMATIC';
const READY_WITH_MANUAL_RATING = 'READY_WITH_MANUAL_RATING';
const MISSING_STATIC_DATA = 'MISSING_STATIC_DATA';
const MISSING_PROFESSIONAL_EVIDENCE = 'MISSING_PROFESSIONAL_EVIDENCE';
const GENERATED_STATUS = 'GENERATED';

const MANUAL_AUTHORIZED_BULK_RATING = 'MANUAL_AUTHORIZED_BULK_RATING';
const BULK_RATING_REASON_AR =
  'اعتماد إداري للبنود المهنية الناقصة للطالب المؤهل';

const SCORE_SOURCE = Object.freeze({
  DIRECT_SUPERVISOR_RATING: 'DIRECT_SUPERVISOR_RATING',
  DERIVED_FROM_PERFORMANCE: 'DERIVED_FROM_PERFORMANCE',
  MANUAL_AUTHORIZED_EVALUATION: 'MANUAL_AUTHORIZED_EVALUATION',
  MANUAL_AUTHORIZED_BULK_RATING,
});

const PROFESSIONAL_CRITERION_EVIDENCE_CODES = Object.freeze({
  CRITERION_1: 'PROFESSIONAL_CRITERION_1_EVIDENCE_MISSING',
  CRITERION_2: 'PROFESSIONAL_CRITERION_2_EVIDENCE_MISSING',
  CRITERION_3: 'PROFESSIONAL_CRITERION_3_EVIDENCE_MISSING',
  CRITERION_4: 'PROFESSIONAL_CRITERION_4_EVIDENCE_MISSING',
  CRITERION_5: 'PROFESSIONAL_CRITERION_5_EVIDENCE_MISSING',
  CRITERION_6: 'PROFESSIONAL_CRITERION_6_EVIDENCE_MISSING',
  CRITERION_7: 'PROFESSIONAL_CRITERION_7_EVIDENCE_MISSING',
  CRITERION_8: 'PROFESSIONAL_CRITERION_8_EVIDENCE_MISSING',
  CRITERION_9: 'PROFESSIONAL_CRITERION_9_EVIDENCE_MISSING',
  CRITERION_10: 'PROFESSIONAL_CRITERION_10_EVIDENCE_MISSING',
});

const STATIC_MISSING_FIELD_CODES = Object.freeze([
  'STUDENT_NAME_MISSING',
  'STUDENT_NUMBER_MISSING',
  'STUDENT_SPECIALTY_MISSING',
  'SEMESTER_MISSING',
  'ACADEMIC_YEAR_MISSING',
  'TRAINING_START_DATE_MISSING',
  'TRAINING_END_DATE_MISSING',
  'TRAINING_DAYS_MISSING',
  'TRAINING_HOURS_MISSING',
  'ABSENCE_DATA_MISSING',
  'ORGANIZATION_NAME_MISSING',
  'ORGANIZATION_DEPARTMENT_MISSING',
  'ORGANIZATION_EMAIL_MISSING',
  'ORGANIZATION_PHONE_MISSING',
  'ORGANIZATION_ADDRESS_MISSING',
  'FIELD_SUPERVISOR_NAME_MISSING',
  'ACADEMIC_SUPERVISOR_NAME_MISSING',
  'ACADEMIC_SUPERVISOR_UNASSIGNED',
]);

const DEFAULT_FIVE_POINT_THRESHOLDS = Object.freeze([
  { min: 90, max: 100, score: 5, labelAr: 'ممتاز' },
  { min: 80, max: 89.99, score: 4, labelAr: 'جيد جداً' },
  { min: 70, max: 79.99, score: 3, labelAr: 'جيد' },
  { min: 60, max: 69.99, score: 2, labelAr: 'متوسط' },
  { min: 0, max: 59.99, score: 1, labelAr: 'ضعيف' },
]);
const ALREADY_GENERATED = 'ALREADY_GENERATED';
const MANUAL_AUTHORIZED_EVALUATION = 'MANUAL_AUTHORIZED_EVALUATION';
const UNAVAILABLE_AR = 'غير متوفر';
const UNASSIGNED_SUPERVISOR_FOLDER = 'مشرف غير محدد';
const ELIGIBLE_FOLDER_AR = 'مؤهل';
const NOT_ELIGIBLE_FOLDER_AR = 'غير مؤهل';
const TRAINING_HOURS_DISPLAY_MODE = Object.freeze({
  TOTAL_COMPLETED_HOURS: 'TOTAL_COMPLETED_HOURS',
  DAILY_HOURS: 'DAILY_HOURS',
});
const OFFICIAL_MUTAH_TEMPLATE_NAME = 'قالب تقييم التدريب الميداني جامعة مؤتة المعتمد';
const OFFICIAL_MUTAH_TEMPLATE_FILENAME = 'قالب_تقييم_التدريب_الميداني_جامعة_مؤتة_معتمد.docx';
/** Official Mutah report: eligible students display 45 training days on the template. */
const ELIGIBLE_OFFICIAL_TRAINING_DAYS = 45;

const FINAL_STATUS = Object.freeze({
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
});

const GATE_REASONS = Object.freeze({
  REQUIRED_HOURS_NOT_COMPLETED: 'REQUIRED_HOURS_NOT_COMPLETED',
  MINIMUM_ATTENDANCE_NOT_ACHIEVED: 'MINIMUM_ATTENDANCE_NOT_ACHIEVED',
  REQUIRED_SUBMISSION_MISSING: 'REQUIRED_SUBMISSION_MISSING',
  POST_ASSESSMENT_NOT_COMPLETED: 'POST_ASSESSMENT_NOT_COMPLETED',
  PROFESSIONAL_EVALUATION_INCOMPLETE: 'PROFESSIONAL_EVALUATION_INCOMPLETE',
});

const GATE_REASON_LABELS_AR = Object.freeze({
  REQUIRED_HOURS_NOT_COMPLETED: 'لم تكتمل الساعات التدريبية المطلوبة',
  MINIMUM_ATTENDANCE_NOT_ACHIEVED: 'نسبة الحضور أقل من الحد المطلوب',
  REQUIRED_SUBMISSION_MISSING: 'لم تكتمل التسليمات المطلوبة',
  POST_ASSESSMENT_NOT_COMPLETED: 'لم يُستكمل الامتحان البعدي',
  PROFESSIONAL_EVALUATION_INCOMPLETE: 'التقييم المهني غير مكتمل',
});

const PLACEHOLDERS = Object.freeze({
  student_name: 'student_name',
  student_number: 'student_number',
  student_specialty: 'student_specialty',
  semester: 'semester',
  academic_year: 'academic_year',
  training_start_date: 'training_start_date',
  training_end_date: 'training_end_date',
  training_days: 'training_days',
  actual_training_hours: 'actual_training_hours',
  actual_daily_hours: 'actual_daily_hours',
  absence_days: 'absence_days',
  attendance_percentage: 'attendance_percentage',
  organization_name: 'organization_name',
  organization_department: 'organization_department',
  organization_email: 'organization_email',
  organization_phone: 'organization_phone',
  organization_fax: 'organization_fax',
  organization_address: 'organization_address',
  completion_status: 'completion_status',
  final_status: 'final_status',
  final_score: 'final_score',
  final_percentage: 'final_percentage',
  professional_evaluation_total: 'professional_evaluation_total',
  professional_evaluation_percentage: 'professional_evaluation_percentage',
  general_comments: 'general_comments',
  field_supervisor_name: 'field_supervisor_name',
  responsible_person_name: 'responsible_person_name',
  evaluation_date: 'evaluation_date',
  field_supervisor_date: 'field_supervisor_date',
  academic_supervisor_date: 'academic_supervisor_date',
  academic_supervisor_name: 'academic_supervisor_name',
  eligibility_reasons: 'eligibility_reasons',
  eligibility_status: 'eligibility_status',
  training_hours_display: 'training_hours_display',
});

const MISSING_FIELD_CODES = Object.freeze({
  STUDENT_NAME_MISSING: 'STUDENT_NAME_MISSING',
  STUDENT_NUMBER_MISSING: 'STUDENT_NUMBER_MISSING',
  STUDENT_SPECIALTY_MISSING: 'STUDENT_SPECIALTY_MISSING',
  SEMESTER_MISSING: 'SEMESTER_MISSING',
  ACADEMIC_YEAR_MISSING: 'ACADEMIC_YEAR_MISSING',
  TRAINING_START_DATE_MISSING: 'TRAINING_START_DATE_MISSING',
  TRAINING_END_DATE_MISSING: 'TRAINING_END_DATE_MISSING',
  TRAINING_DAYS_MISSING: 'TRAINING_DAYS_MISSING',
  TRAINING_HOURS_MISSING: 'TRAINING_HOURS_MISSING',
  ABSENCE_DATA_MISSING: 'ABSENCE_DATA_MISSING',
  ORGANIZATION_NAME_MISSING: 'ORGANIZATION_NAME_MISSING',
  ORGANIZATION_DEPARTMENT_MISSING: 'ORGANIZATION_DEPARTMENT_MISSING',
  ORGANIZATION_EMAIL_MISSING: 'ORGANIZATION_EMAIL_MISSING',
  ORGANIZATION_PHONE_MISSING: 'ORGANIZATION_PHONE_MISSING',
  ORGANIZATION_ADDRESS_MISSING: 'ORGANIZATION_ADDRESS_MISSING',
  FIELD_SUPERVISOR_NAME_MISSING: 'FIELD_SUPERVISOR_NAME_MISSING',
  ACADEMIC_SUPERVISOR_NAME_MISSING: 'ACADEMIC_SUPERVISOR_NAME_MISSING',
  ACADEMIC_SUPERVISOR_UNASSIGNED: 'ACADEMIC_SUPERVISOR_UNASSIGNED',
  PROFESSIONAL_RATING_WORK_EFFICIENCY_MISSING: 'PROFESSIONAL_RATING_WORK_EFFICIENCY_MISSING',
  PROFESSIONAL_RATING_ACCURACY_MISSING: 'PROFESSIONAL_RATING_ACCURACY_MISSING',
  PROFESSIONAL_RATING_THINKING_MISSING: 'PROFESSIONAL_RATING_THINKING_MISSING',
  PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING: 'PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING',
  PROFESSIONAL_RATING_ATTENDANCE_MISSING: 'PROFESSIONAL_RATING_ATTENDANCE_MISSING',
  PROFESSIONAL_RATING_TEAMWORK_MISSING: 'PROFESSIONAL_RATING_TEAMWORK_MISSING',
  PROFESSIONAL_RATING_APPEARANCE_MISSING: 'PROFESSIONAL_RATING_APPEARANCE_MISSING',
  PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING: 'PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING',
  PROFESSIONAL_RATING_TASKS_MISSING: 'PROFESSIONAL_RATING_TASKS_MISSING',
  PROFESSIONAL_RATING_RULES_MISSING: 'PROFESSIONAL_RATING_RULES_MISSING',
  PROFESSIONAL_TOTAL_MISSING: 'PROFESSIONAL_TOTAL_MISSING',
  GENERAL_COMMENTS_MISSING: 'GENERAL_COMMENTS_MISSING',
  EVALUATION_DATE_MISSING: 'EVALUATION_DATE_MISSING',
  FIELD_SUPERVISOR_DATE_MISSING: 'FIELD_SUPERVISOR_DATE_MISSING',
  ACADEMIC_SUPERVISOR_DATE_MISSING: 'ACADEMIC_SUPERVISOR_DATE_MISSING',
  ELIGIBILITY_STATUS_MISSING: 'ELIGIBILITY_STATUS_MISSING',
  ELIGIBILITY_REASONS_MISSING: 'ELIGIBILITY_REASONS_MISSING',
});

const MISSING_FIELD_LABELS_AR = Object.freeze({
  STUDENT_NAME_MISSING: 'اسم الطالب',
  STUDENT_NUMBER_MISSING: 'الرقم الجامعي',
  STUDENT_SPECIALTY_MISSING: 'التخصص',
  SEMESTER_MISSING: 'الفصل الدراسي',
  ACADEMIC_YEAR_MISSING: 'السنة الدراسية',
  TRAINING_START_DATE_MISSING: 'تاريخ بداية التدريب',
  TRAINING_END_DATE_MISSING: 'تاريخ نهاية التدريب',
  TRAINING_DAYS_MISSING: 'عدد أيام التدريب',
  TRAINING_HOURS_MISSING: 'الساعات التدريبية المكتملة',
  ABSENCE_DATA_MISSING: 'بيانات الغياب',
  ORGANIZATION_NAME_MISSING: 'اسم الشركة أو المؤسسة',
  ORGANIZATION_DEPARTMENT_MISSING: 'الفرع أو القسم',
  ORGANIZATION_EMAIL_MISSING: 'البريد الإلكتروني للمؤسسة',
  ORGANIZATION_PHONE_MISSING: 'هاتف المؤسسة',
  ORGANIZATION_ADDRESS_MISSING: 'عنوان المؤسسة',
  FIELD_SUPERVISOR_NAME_MISSING: 'اسم المشرف الميداني',
  ACADEMIC_SUPERVISOR_NAME_MISSING: 'اسم المسؤول (المشرف الأكاديمي)',
  ACADEMIC_SUPERVISOR_UNASSIGNED: 'المشرف الأكاديمي غير محدد',
  PROFESSIONAL_RATING_WORK_EFFICIENCY_MISSING: 'تقييم الكفاءة في إنجاز العمل',
  PROFESSIONAL_RATING_ACCURACY_MISSING: 'تقييم مراعاة الدقة في العمل',
  PROFESSIONAL_RATING_THINKING_MISSING: 'تقييم القدرة على التفكير وطرح الأسئلة',
  PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING: 'تقييم القدرة على حل المشكلات',
  PROFESSIONAL_RATING_ATTENDANCE_MISSING: 'تقييم الالتزام بالدوام',
  PROFESSIONAL_RATING_TEAMWORK_MISSING: 'تقييم العلاقات مع الزملاء',
  PROFESSIONAL_RATING_APPEARANCE_MISSING: 'تقييم المظهر واللياقة العامة',
  PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING: 'تقييم التعاون مع المشرف الميداني',
  PROFESSIONAL_RATING_TASKS_MISSING: 'تقييم إتمام التدريبات والوظائف',
  PROFESSIONAL_RATING_RULES_MISSING: 'تقييم الالتزام بقواعد المؤسسة',
  PROFESSIONAL_TOTAL_MISSING: 'المجموع',
  GENERAL_COMMENTS_MISSING: 'الملاحظات العامة',
  EVALUATION_DATE_MISSING: 'تاريخ التقييم',
  FIELD_SUPERVISOR_DATE_MISSING: 'تاريخ المشرف الميداني',
  ACADEMIC_SUPERVISOR_DATE_MISSING: 'تاريخ المسؤول الأكاديمي',
  ELIGIBILITY_STATUS_MISSING: 'حالة الأهلية',
  ELIGIBILITY_REASONS_MISSING: 'أسباب عدم التأهيل',
});

const PAYLOAD_KEY_TO_MISSING_CODE = Object.freeze({
  student_name: 'STUDENT_NAME_MISSING',
  student_number: 'STUDENT_NUMBER_MISSING',
  student_specialty: 'STUDENT_SPECIALTY_MISSING',
  semester: 'SEMESTER_MISSING',
  academic_year: 'ACADEMIC_YEAR_MISSING',
  training_start_date: 'TRAINING_START_DATE_MISSING',
  training_end_date: 'TRAINING_END_DATE_MISSING',
  training_days: 'TRAINING_DAYS_MISSING',
  training_hours_display: 'TRAINING_HOURS_MISSING',
  actual_training_hours: 'TRAINING_HOURS_MISSING',
  absence_days: 'ABSENCE_DATA_MISSING',
  organization_name: 'ORGANIZATION_NAME_MISSING',
  organization_department: 'ORGANIZATION_DEPARTMENT_MISSING',
  organization_email: 'ORGANIZATION_EMAIL_MISSING',
  organization_phone: 'ORGANIZATION_PHONE_MISSING',
  organization_address: 'ORGANIZATION_ADDRESS_MISSING',
  field_supervisor_name: 'FIELD_SUPERVISOR_NAME_MISSING',
  responsible_person_name: 'ACADEMIC_SUPERVISOR_NAME_MISSING',
  academic_supervisor_name: 'ACADEMIC_SUPERVISOR_NAME_MISSING',
  general_comments: 'GENERAL_COMMENTS_MISSING',
  evaluation_date: 'EVALUATION_DATE_MISSING',
  field_supervisor_date: 'FIELD_SUPERVISOR_DATE_MISSING',
  academic_supervisor_date: 'ACADEMIC_SUPERVISOR_DATE_MISSING',
  eligibility_status: 'ELIGIBILITY_STATUS_MISSING',
  eligibility_reasons: 'ELIGIBILITY_REASONS_MISSING',
  professional_evaluation_total: 'PROFESSIONAL_TOTAL_MISSING',
  criterion_1_score: 'PROFESSIONAL_RATING_WORK_EFFICIENCY_MISSING',
  criterion_2_score: 'PROFESSIONAL_RATING_ACCURACY_MISSING',
  criterion_3_score: 'PROFESSIONAL_RATING_THINKING_MISSING',
  criterion_4_score: 'PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING',
  criterion_5_score: 'PROFESSIONAL_RATING_ATTENDANCE_MISSING',
  criterion_6_score: 'PROFESSIONAL_RATING_TEAMWORK_MISSING',
  criterion_7_score: 'PROFESSIONAL_RATING_APPEARANCE_MISSING',
  criterion_8_score: 'PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING',
  criterion_9_score: 'PROFESSIONAL_RATING_TASKS_MISSING',
  criterion_10_score: 'PROFESSIONAL_RATING_RULES_MISSING',
});

const ELIGIBILITY_REASON_CODES = Object.freeze({
  ATTENDANCE_BELOW_MINIMUM: 'ATTENDANCE_BELOW_MINIMUM',
  REQUIRED_HOURS_INCOMPLETE: 'REQUIRED_HOURS_INCOMPLETE',
  REQUIRED_TASKS_INCOMPLETE: 'REQUIRED_TASKS_INCOMPLETE',
  POST_ASSESSMENT_INCOMPLETE: 'POST_ASSESSMENT_INCOMPLETE',
  OTHER_EXISTING_ELIGIBILITY_RULE: 'OTHER_EXISTING_ELIGIBILITY_RULE',
});

const CRITERION_SCORE_KEYS = Object.freeze(
  Array.from({ length: 10 }, (_, i) => `criterion_${i + 1}_score`)
);

const PROFESSIONAL_CRITERIA = Object.freeze([
  { index: 1, key: 'workEfficiency', labelEn: 'Work completion efficiency', labelAr: 'كفاءة إنجاز العمل' },
  { index: 2, key: 'accuracy', labelEn: 'Accuracy in work', labelAr: 'الدقة في العمل' },
  { index: 3, key: 'thinkingAndInitiative', labelEn: 'Ability to think and ask questions', labelAr: 'القدرة على التفكير وطرح الأسئلة' },
  { index: 4, key: 'problemSolving', labelEn: 'Problem-solving ability', labelAr: 'القدرة على حل المشكلات' },
  { index: 5, key: 'attendanceCommitment', labelEn: 'Attendance and working-time commitment', labelAr: 'الالتزام بالحضور وأوقات العمل' },
  { index: 6, key: 'teamwork', labelEn: 'Relationships/cooperation with colleagues', labelAr: 'العلاقات والتعاون مع الزملاء' },
  { index: 7, key: 'professionalConduct', labelEn: 'Professional appearance/general conduct', labelAr: 'المظهر المهني والسلوك العام' },
  { index: 8, key: 'supervisorCooperation', labelEn: 'Cooperation with field supervisor and institution management', labelAr: 'التعاون مع المشرف الميداني وإدارة المؤسسة' },
  { index: 9, key: 'requiredTasks', labelEn: 'Completion of required training/tasks', labelAr: 'إنجاز التدريب/المهام المطلوبة' },
  { index: 10, key: 'rulesCompliance', labelEn: 'Compliance with institution rules/instructions', labelAr: 'الالتزام بأنظمة وتعليمات المؤسسة' },
]);

const SUPERVISOR_RATING_FIELDS = Object.freeze([
  'thinkingAndInitiative',
  'problemSolving',
  'teamwork',
  'professionalConduct',
  'supervisorCooperation',
  'rulesCompliance',
]);

const REQUIRED_PLACEHOLDER_GROUPS = Object.freeze([
  { id: 'student_name', label: 'Student Name', keys: ['student_name'] },
  { id: 'student_number', label: 'Student Number', keys: ['student_number'] },
  { id: 'training_dates', label: 'Training Dates', keys: ['training_start_date', 'training_end_date'] },
  { id: 'evaluation_grid', label: 'Evaluation Grid', keys: ['c1_1', 'c10_5'] },
  { id: 'professional_total', label: 'Professional Total', keys: ['professional_evaluation_total'] },
  { id: 'general_comments', label: 'General Comments', keys: ['general_comments'] },
]);

const DEFAULT_ATTENDANCE_BANDS = Object.freeze([
  { min: 98, max: 100, score: 5 },
  { min: 95, max: 97.99, score: 4 },
  { min: 90, max: 94.99, score: 3 },
  { min: 80, max: 89.99, score: 2 },
  { min: 0, max: 79.99, score: 1 },
]);

const DEFAULT_POLICY = Object.freeze({
  minimumAttendancePercentage: 80,
  requiredTrainingHours: null,
  requiredTasksRequired: true,
  postAssessmentRequired: true,
  professionalEvaluationRequired: true,
  minimumPassingScore: 60,
  attendanceWeight: 20,
  tasksWeight: 20,
  postAssessmentWeight: 20,
  professionalEvaluationWeight: 40,
  attendanceBands: DEFAULT_ATTENDANCE_BANDS,
});

const ACCEPTED_TASK_STATUSES = Object.freeze(['approved', 'graded']);
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_TEMPLATE_BYTES = 50 * 1024 * 1024;
const CHECKMARK = '✓';
const STORAGE_FOLDER = 'training';

module.exports = {
  TEMPLATE_MISSING_CODE,
  PROFESSIONAL_INCOMPLETE_CODE,
  DATA_INCOMPLETE_CODE,
  STUDENT_NUMBER_UNRESOLVED_CODE,
  UNRESOLVED_PLACEHOLDERS_CODE,
  PDF_RENDER_FAILED_CODE,
  TEMPLATE_FIDELITY_FAIL,
  TEMPLATE_FONT_UNAVAILABLE,
  READY_STATUS,
  MISSING_REQUIRED_DATA,
  READY_AUTOMATIC,
  READY_WITH_MANUAL_RATING,
  MISSING_STATIC_DATA,
  MISSING_PROFESSIONAL_EVIDENCE,
  GENERATED_STATUS,
  MANUAL_AUTHORIZED_BULK_RATING,
  BULK_RATING_REASON_AR,
  SCORE_SOURCE,
  PROFESSIONAL_CRITERION_EVIDENCE_CODES,
  STATIC_MISSING_FIELD_CODES,
  DEFAULT_FIVE_POINT_THRESHOLDS,
  ALREADY_GENERATED,
  MANUAL_AUTHORIZED_EVALUATION,
  UNAVAILABLE_AR,
  UNASSIGNED_SUPERVISOR_FOLDER,
  ELIGIBLE_FOLDER_AR,
  NOT_ELIGIBLE_FOLDER_AR,
  TRAINING_HOURS_DISPLAY_MODE,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
  OFFICIAL_MUTAH_TEMPLATE_FILENAME,
  ELIGIBLE_OFFICIAL_TRAINING_DAYS,
  FINAL_STATUS,
  GATE_REASONS,
  GATE_REASON_LABELS_AR,
  PLACEHOLDERS,
  MISSING_FIELD_CODES,
  MISSING_FIELD_LABELS_AR,
  PAYLOAD_KEY_TO_MISSING_CODE,
  ELIGIBILITY_REASON_CODES,
  CRITERION_SCORE_KEYS,
  PROFESSIONAL_CRITERIA,
  SUPERVISOR_RATING_FIELDS,
  REQUIRED_PLACEHOLDER_GROUPS,
  DEFAULT_ATTENDANCE_BANDS,
  DEFAULT_POLICY,
  ACCEPTED_TASK_STATUSES,
  DOCX_MIME,
  MAX_TEMPLATE_BYTES,
  CHECKMARK,
  STORAGE_FOLDER,
};
