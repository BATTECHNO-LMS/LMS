export const ROLE_LABELS_AR = {
  instructor: 'مدرّس',
  student: 'طالب',
  admin: 'إداري',
  qa_officer: 'مسؤول جودة',
};

export function roleLabelAr(role) {
  return ROLE_LABELS_AR[role] ?? role;
}

export const ASSESSMENT_TYPE_LABELS_AR = {
  quiz: 'اختبار',
  assignment: 'واجب',
  project: 'مشروع',
  exam: 'امتحان',
};

export function assessmentTypeLabelAr(type) {
  return ASSESSMENT_TYPE_LABELS_AR[type] ?? type;
}
