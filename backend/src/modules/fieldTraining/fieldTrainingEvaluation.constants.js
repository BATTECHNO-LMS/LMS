'use strict';

const TEMPLATE_MISSING_CODE = 'FIELD_TRAINING_EVALUATION_TEMPLATE_MISSING';
const PROFESSIONAL_INCOMPLETE_CODE = 'PROFESSIONAL_EVALUATION_INCOMPLETE';
const DATA_INCOMPLETE_CODE = 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE';
const STUDENT_NUMBER_UNRESOLVED_CODE = 'STUDENT_NUMBER_UNRESOLVED';
const UNRESOLVED_PLACEHOLDERS_CODE = 'UNRESOLVED_PLACEHOLDERS';
const PDF_RENDER_FAILED_CODE = 'PDF_RENDER_FAILED';
const UNAVAILABLE_AR = 'غير متوفر';
const OFFICIAL_MUTAH_TEMPLATE_NAME = 'قالب تقييم التدريب الميداني جامعة مؤتة المعتمد';
const OFFICIAL_MUTAH_TEMPLATE_FILENAME = 'قالب_تقييم_التدريب_الميداني_جامعة_مؤتة_معتمد.docx';

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
  eligibility_reasons: 'eligibility_reasons',
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
  UNAVAILABLE_AR,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
  OFFICIAL_MUTAH_TEMPLATE_FILENAME,
  FINAL_STATUS,
  GATE_REASONS,
  GATE_REASON_LABELS_AR,
  PLACEHOLDERS,
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
