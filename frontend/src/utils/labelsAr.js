import { getCurrentLocale, normalizeLocale } from './locale.js';

import { canonicalizeRoleCode } from '../constants/roles.js';

export const ROLE_LABELS_AR = {
  instructor: 'مدرّس',
  student: 'طالب',
  admin: 'أدمن',
  super_admin: 'سوبر أدمن',
  reviewer: 'مراجع',
  trainer: 'مدرب',
  trainee: 'متدرب',
  program_admin: 'إداري برامج — متوقف',
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
  super_admin: 'Super admin',
  reviewer: 'Reviewer',
  trainer: 'Trainer',
  trainee: 'Trainee',
  program_admin: 'Program Admin — Deprecated',
};

const ASSESSMENT_TYPE_LABELS_EN = {
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  exam: 'Exam',
};

export function roleLabelAr(role, locale = getCurrentLocale()) {
  const map = normalizeLocale(locale) === 'en' ? ROLE_LABELS_EN : ROLE_LABELS_AR;
  const raw = String(role || '')
    .trim()
    .toLowerCase();
  // Preserve deprecated historical label before aliasing to canonical admin.
  if (raw === 'program_admin' && map.program_admin) {
    return map.program_admin;
  }
  const code = canonicalizeRoleCode(role);
  return map[code] ?? map[role] ?? role;
}

export function assessmentTypeLabelAr(type, locale = getCurrentLocale()) {
  const map = normalizeLocale(locale) === 'en' ? ASSESSMENT_TYPE_LABELS_EN : ASSESSMENT_TYPE_LABELS_AR;
  return map[type] ?? type;
}
