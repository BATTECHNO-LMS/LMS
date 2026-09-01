'use strict';

const FIELD_LABELS_AR = Object.freeze({
  'Student Name': 'اسم الطالب',
  'Student Number': 'الرقم الجامعي',
  'Training Dates': 'فترة التدريب',
  'Evaluation Grid': 'بنود التقييم',
  'Professional Total': 'مجموع التقييم المهني',
  'General Comments': 'الملاحظات العامة',
  student_name: 'اسم الطالب',
  studentName: 'اسم الطالب',
  student_number: 'الرقم الجامعي',
  studentNumber: 'الرقم الجامعي',
  university_number: 'الرقم الجامعي',
  student_specialty: 'التخصص',
  training_dates: 'فترة التدريب',
  training_start_date: 'بداية التدريب',
  training_end_date: 'نهاية التدريب',
  evaluation_grid: 'بنود التقييم',
  professional_total: 'مجموع التقييم المهني',
  professional_evaluation_total: 'مجموع التقييم المهني',
  general_comments: 'الملاحظات العامة',
  organization_name: 'اسم جهة التدريب',
  organization_department: 'الفرع أو القسم',
  organization_email: 'البريد الإلكتروني لجهة التدريب',
  organization_phone: 'هاتف جهة التدريب',
  organization_fax: 'فاكس جهة التدريب',
  organization_address: 'عنوان جهة التدريب',
  responsible_person_name: 'اسم المسؤول (المشرف الأكاديمي)',
  field_supervisor_name: 'اسم المشرف الميداني',
  academic_supervisor_name: 'اسم المشرف الأكاديمي',
  evaluation_date: 'تاريخ التقييم',
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
  semester: 'الفصل الدراسي',
  academic_year: 'السنة الدراسية',
  training_days: 'أيام التدريب',
  actual_daily_hours: 'الساعات اليومية',
  actual_training_hours: 'الساعات التدريبية المكتملة',
  training_hours_display: 'الساعات التدريبية المكتملة',
  absence_days: 'أيام الغياب',
  criterion_1_score: 'بند التقييم 1',
  criterion_2_score: 'بند التقييم 2',
  criterion_3_score: 'بند التقييم 3',
  criterion_4_score: 'بند التقييم 4',
  criterion_5_score: 'بند التقييم 5',
  criterion_6_score: 'بند التقييم 6',
  criterion_7_score: 'بند التقييم 7',
  criterion_8_score: 'بند التقييم 8',
  criterion_9_score: 'بند التقييم 9',
  criterion_10_score: 'بند التقييم 10',
});

const FIELD_LABELS_EN = Object.freeze({
  'Student Name': 'Student name',
  'Student Number': 'University number',
  'Training Dates': 'Training period',
  'Evaluation Grid': 'Evaluation criteria',
  'Professional Total': 'Professional evaluation total',
  'General Comments': 'General comments',
  student_name: 'Student name',
  studentName: 'Student name',
  student_number: 'University number',
  organization_name: 'Training organization name',
  responsible_person_name: 'Academic supervisor / responsible person',
  field_supervisor_name: 'Field supervisor name',
  TRAINING_DAYS_MISSING: 'Training days',
  TRAINING_HOURS_MISSING: 'Completed training hours',
  ABSENCE_DATA_MISSING: 'Absence data',
  FIELD_SUPERVISOR_DATE_MISSING: 'Field supervisor date',
  ACADEMIC_SUPERVISOR_DATE_MISSING: 'Academic supervisor date',
  ELIGIBILITY_STATUS_MISSING: 'Eligibility status',
  ELIGIBILITY_REASONS_MISSING: 'Ineligibility reasons',
});

function isArabicLocale(locale) {
  return String(locale || 'ar').toLowerCase().startsWith('ar');
}

export function translateEvaluationFieldLabel(value, locale = 'ar') {
  const key = String(value || '').trim();
  if (!key) return '';
  const table = isArabicLocale(locale) ? FIELD_LABELS_AR : FIELD_LABELS_EN;
  if (table[key]) return table[key];
  const lower = key.toLowerCase();
  if (table[lower]) return table[lower];
  return key.replace(/_/g, ' ');
}

export function translateEvaluationFieldLabels(values, locale = 'ar') {
  return [...new Set((values || []).map((value) => translateEvaluationFieldLabel(value, locale)).filter(Boolean))];
}

export { FIELD_LABELS_AR, FIELD_LABELS_EN };
