import {
  LayoutDashboard,
  Layers,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  Upload,
  BarChart3,
  FolderOpen,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Award,
  FileBadge,
} from 'lucide-react';
import { ROLES, ADMIN_ROLE_SET } from './roles.js';
import { UI_PERMISSION } from './permissions.js';
import { flattenAdminNavItems, getAdminNavGroupsForRole } from './adminNavigation.js';
import { hasUiPermission, canAccessPathWithUiPermissions } from '../utils/rolePermissions.js';

const P = UI_PERMISSION;

function navItem(to, label, icon, permission) {
  return { to, label, icon, permission };
}

/** Non-admin roles — `{ to, label, icon, permission }`. */
export const NAV_BY_ROLE = {
  [ROLES.INSTRUCTOR]: [
    navItem('/instructor/dashboard', 'الرئيسية', LayoutDashboard, P.canViewDashboard),
    navItem('/instructor/cohorts', 'دفعاتي', Layers, P.canManageCohorts),
    navItem('/instructor/sessions', 'الجلسات', CalendarDays, P.canManageSessions),
    navItem('/instructor/attendance', 'الحضور', ClipboardCheck, P.canManageAttendance),
    navItem('/instructor/assessments', 'التقييمات', FileCheck, P.canViewAssessments),
    navItem('/instructor/submissions', 'التسليمات', Upload, P.canViewSubmissionsTeaching),
    navItem('/instructor/grades', 'الدرجات', BarChart3, P.canViewGradesTeaching),
    navItem('/instructor/evidence', 'الأدلة', FolderOpen, P.canUploadEvidence),
    navItem('/instructor/risk-students', 'الطلبة المتعثرون', AlertTriangle, P.canManageRiskStudents),
  ],

  [ROLES.STUDENT]: [
    navItem('/student/dashboard', 'الرئيسية', LayoutDashboard, P.canViewDashboard),
    navItem('/student/programs', 'شهاداتي المسجل بها', GraduationCap, P.canViewEnrolledPrograms),
    navItem('/student/content', 'المحتوى', BookOpen, P.canViewContent),
    navItem('/student/sessions', 'الجلسات', CalendarDays, P.canViewSessions),
    navItem('/student/attendance', 'الحضور', ClipboardCheck, P.canViewAttendance),
    navItem('/student/assessments', 'التقييمات', FileCheck, P.canViewAssessments),
    navItem('/student/submissions', 'التسليمات', Upload, P.canViewSubmissionStatus),
    navItem('/student/grades', 'الدرجات', BarChart3, P.canViewGrades),
    navItem('/student/certificate', 'الشهادة الرقمية', Award, P.canViewCertificates),
  ],

  [ROLES.UNIVERSITY_REVIEWER]: [
    navItem('/reviewer/dashboard', 'الرئيسية', LayoutDashboard, P.canViewDashboard),
    navItem('/reviewer/recognition-requests', 'طلبات الاعتراف الأكاديمي', FileBadge, P.canViewRecognitionRequests),
    navItem('/reviewer/university-reports', 'تقارير الجامعة', BarChart3, P.canViewUniversityReports),
    navItem('/reviewer/evidence', 'الأدلة والمرفقات', FolderOpen, P.canViewReviewerEvidence),
    navItem('/reviewer/certificates', 'الشهادات المرتبطة', Award, P.canViewLinkedCertificates),
  ],
};

function filterNavItemsByUi(role, items) {
  if (!items) return [];
  return items.filter((item) => hasUiPermission(role, item.permission));
}

/**
 * Unified sidebar: admin groups unchanged; other roles filtered by UI permissions.
 */
export function getDashboardNavGroups(role) {
  if (!role) return [];
  if (ADMIN_ROLE_SET.includes(role)) {
    return getAdminNavGroupsForRole(role);
  }
  const items = filterNavItemsByUi(role, NAV_BY_ROLE[role]);
  if (!items.length) return [];
  return [{ id: 'main', title: 'القائمة الرئيسية', items }];
}

export function getNavItemsForRole(role) {
  if (role && ADMIN_ROLE_SET.includes(role)) {
    return flattenAdminNavItems(role);
  }
  return filterNavItemsByUi(role, NAV_BY_ROLE[role] ?? NAV_BY_ROLE[ROLES.STUDENT]);
}

const CRUD_MODULE_TITLES = {
  users: 'المستخدمون',
  universities: 'الجامعات',
  tracks: 'المسارات',
  'micro-credentials': 'الشهادات المصغرة',
  cohorts: 'الدفعات',
  assessments: 'التقييمات',
  'recognition-requests': 'طلبات الاعتراف الأكاديمي',
};

function matchCrudTitle(pathname) {
  const clean = pathname.replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] !== 'admin') return null;
  const mod = parts[1];
  const base = CRUD_MODULE_TITLES[mod];
  if (!base) return null;
  if (parts[2] === 'create') return `${base} — إنشاء`;
  if (parts[3] === 'edit') return `${base} — تعديل`;
  if (parts[2] && parts[2] !== 'create' && !parts[3]) return `${base} — تفاصيل`;
  return null;
}

const INSTRUCTOR_ASSESSMENT_TITLES = {
  create: 'التقييمات — إضافة',
  edit: 'التقييمات — تعديل',
};

export function getPageTitleForPath(role, pathname) {
  const crud = matchCrudTitle(pathname);
  if (crud) return crud;

  if (pathname.includes('/instructor/assessments/create')) return INSTRUCTOR_ASSESSMENT_TITLES.create;
  if (/\/instructor\/assessments\/.+\/edit/.test(pathname)) return INSTRUCTOR_ASSESSMENT_TITLES.edit;

  const items = getNavItemsForRole(role);
  const exact = items.find((n) => n.to === pathname);
  if (exact) return exact.label;

  const sorted = [...items].sort((a, b) => b.to.length - a.to.length);
  const prefix = sorted.find((n) => pathname.startsWith(`${n.to}/`));
  if (prefix) return prefix.label;

  return 'BATTECHNO-LMS';
}

export function canAccessPath(role, pathname) {
  if (!role) return false;
  if (ADMIN_ROLE_SET.includes(role)) {
    const items = flattenAdminNavItems(role);
    return items.some((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  }
  if (!canAccessPathWithUiPermissions(role, pathname)) return false;
  const items = getNavItemsForRole(role);
  return items.some((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
}
