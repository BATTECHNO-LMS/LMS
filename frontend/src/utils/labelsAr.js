import { getCurrentLocale, normalizeLocale } from './locale.js';

export const ROLE_LABELS_AR = {
  instructor: 'مدرّس',
  student: 'طالب',
  admin: 'إداري',
  qa_officer: 'مسؤول جودة',
};

export const ASSESSMENT_TYPE_LABELS_AR = {
  quiz: 'اختبار',
  assignment: 'واجب',
  project: 'مشروع',
  exam: 'امتحان',
};

const ROLE_LABELS_EN = {
  instructor: 'Instructor',
  student: 'Student',
  admin: 'Admin',
  qa_officer: 'QA Officer',
};

const ASSESSMENT_TYPE_LABELS_EN = {
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  exam: 'Exam',
};

export function roleLabelAr(role, locale = getCurrentLocale()) {
  const map = normalizeLocale(locale) === 'en' ? ROLE_LABELS_EN : ROLE_LABELS_AR;
  return map[role] ?? role;
}

export function assessmentTypeLabelAr(type, locale = getCurrentLocale()) {
  const map = normalizeLocale(locale) === 'en' ? ASSESSMENT_TYPE_LABELS_EN : ASSESSMENT_TYPE_LABELS_AR;
  return map[type] ?? type;
}
