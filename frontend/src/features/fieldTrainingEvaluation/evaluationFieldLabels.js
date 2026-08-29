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
  responsible_person_name: 'اسم المسؤول في جهة التدريب',
  field_supervisor_name: 'اسم المشرف الميداني',
  evaluation_date: 'تاريخ التقييم',
  semester: 'الفصل الدراسي',
  academic_year: 'السنة الدراسية',
  training_days: 'أيام التدريب',
  actual_daily_hours: 'الساعات اليومية',
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
  responsible_person_name: 'Responsible person at the organization',
  field_supervisor_name: 'Field supervisor name',
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
