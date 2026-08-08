import { ROLES } from './roles.js';

/** @typedef {'UNIVERSITY' | 'INSTITUTION'} PortalType */

export const PORTAL_TYPES = Object.freeze({
  UNIVERSITY: 'UNIVERSITY',
  INSTITUTION: 'INSTITUTION',
});

/**
 * Central portal entry configuration (UI + non-authoritative login hints).
 */
export const PORTAL_ENTRIES = Object.freeze({
  UNIVERSITY: {
    type: PORTAL_TYPES.UNIVERSITY,
    loginPath: '/universities/login',
    registerPath: '/register',
    titleAr: 'بوابة الجامعات',
    titleEn: 'Universities portal',
    descriptionAr:
      'لإدارة التدريب الميداني والطلاب والجلسات والحضور والمهمات والاختبارات والتقارير الجامعية.',
    descriptionEn:
      'Manage field training, students, sessions, attendance, tasks, assessments, and university reports.',
    primaryCtaAr: 'الدخول إلى بوابة الجامعات',
    primaryCtaEn: 'Enter universities portal',
    secondaryCtaAr: 'إنشاء حساب طالب',
    secondaryCtaEn: 'Create student account',
    showSecondaryRegister: true,
  },
  INSTITUTION: {
    type: PORTAL_TYPES.INSTITUTION,
    loginPath: '/institutions/login',
    registerPath: '/institutions/register',
    titleAr: 'بوابة المؤسسات',
    titleEn: 'Institutions portal',
    descriptionAr:
      'لإدارة الدورات التدريبية والمتدربين والموظفين والجلسات والتقييمات ومؤشرات الأداء والتقارير المؤسسية.',
    descriptionEn:
      'Manage training courses, trainees, staff, sessions, evaluations, KPIs, and institutional reports.',
    primaryCtaAr: 'الدخول إلى بوابة المؤسسات',
    primaryCtaEn: 'Enter institutions portal',
    secondaryCtaAr: 'إنشاء حساب متدرب',
    secondaryCtaEn: 'Create trainee account',
    showSecondaryRegister: true,
    loginSubtitleAr:
      'تسجيل دخول مسؤولي المؤسسات والمدربين والمتدربين والمراجعين لإدارة ومتابعة البرامج التدريبية.',
    loginSubtitleEn:
      'Sign in for institution admins, trainers, trainees, and reviewers to manage training programs.',
    loginPanelTitleAr: 'إدارة تدريب مؤسسي أكثر كفاءة',
    loginPanelSubtitleAr:
      'منصة موحدة لإدارة الدورات التدريبية، المتدربين، الجلسات، الحضور، التقييمات، مؤشرات الأداء والشهادات المهنية.',
    loginIllustrationAltAr: 'رسم توضيحي لإدارة البرامج التدريبية داخل المؤسسات',
    loginFeatureIndicatorsAr: ['إدارة الدورات', 'متابعة الأداء', 'تقارير وشهادات'],
    registerCtaPromptAr: 'متدرب جديد؟',
    registerCtaLinkAr: 'إنشاء حساب متدرب',
    decorTheme: 'institution',
  },
});

export const PORTAL_SELECTION_PATH = '/portals';
export const SELECT_ORGANIZATION_PATH = '/select-organization';

/**
 * Role → home path by organization type (existing routes only).
 * @param {string} roleCode
 * @param {PortalType | null | undefined} organizationType
 * @param {{ organizationId?: string | null }} [ctx]
 */
export function resolveDashboardPathForRole(roleCode, organizationType, ctx = {}) {
  const role = String(roleCode || '');
  if (role === ROLES.SUPER_ADMIN) return '/admin/dashboard';

  if (organizationType === PORTAL_TYPES.INSTITUTION) {
    if (role === ROLES.ADMIN && ctx.organizationId) {
      return `/admin/institutions/${ctx.organizationId}`;
    }
    if (role === ROLES.ADMIN) return '/admin/institutions';
    if (role === ROLES.TRAINER) return '/trainer';
    if (role === ROLES.TRAINEE) return '/trainee';
    if (role === ROLES.STUDENT) return '/trainee';
    if (role === ROLES.REVIEWER) return '/reviewer/dashboard';
    // Do not route university instructors into the institution trainer shell.
  }

  // UNIVERSITY or unknown — existing university / field-training homes
  if (role === ROLES.ADMIN) return '/admin/dashboard';
  if (role === ROLES.INSTRUCTOR) return '/instructor/dashboard';
  if (role === ROLES.TRAINER) return '/institutions/login';
  if (role === ROLES.TRAINEE) return '/institutions/login';
  if (role === ROLES.STUDENT) return '/student/dashboard';
  if (role === ROLES.REVIEWER) return '/reviewer/dashboard';
  return '/portals';
}

export const UNIVERSITY_PORTAL_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.STUDENT,
  ROLES.REVIEWER,
]);

export const INSTITUTION_PORTAL_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.TRAINER,
  ROLES.TRAINEE,
  ROLES.REVIEWER,
]);

/**
 * @param {string | null | undefined} selectedPortal
 * @param {string | null | undefined} organizationType
 */
export function isPortalMismatch(selectedPortal, organizationType) {
  if (!selectedPortal || !organizationType) return false;
  if (selectedPortal === PORTAL_TYPES.UNIVERSITY && organizationType === PORTAL_TYPES.INSTITUTION) {
    return true;
  }
  if (selectedPortal === PORTAL_TYPES.INSTITUTION && organizationType === PORTAL_TYPES.UNIVERSITY) {
    return true;
  }
  return false;
}

export function portalMismatchMessageAr(organizationType) {
  if (organizationType === PORTAL_TYPES.INSTITUTION) {
    return 'هذا الحساب مرتبط ببوابة المؤسسات. يرجى تسجيل الدخول من بوابة المؤسسات.';
  }
  if (organizationType === PORTAL_TYPES.UNIVERSITY) {
    return 'هذا الحساب مرتبط ببوابة الجامعات. يرجى تسجيل الدخول من بوابة الجامعات.';
  }
  return 'هذا الحساب مرتبط ببوابة مختلفة. يرجى تسجيل الدخول من البوابة المناسبة.';
}
