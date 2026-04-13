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
  Bell,
} from 'lucide-react';
import { ROLES, ADMIN_ROLE_SET } from './roles.js';
import { UI_PERMISSION } from './permissions.js';
import {
  flattenAdminNavItems,
  flattenAdminNavPaths,
  getAdminNavGroupsForRole,
} from './adminNavigation.js';
import { hasUiPermissionForUser, canAccessPathWithUiPermissionsForUser } from '../utils/rolePermissions.js';
import i18n from '../i18n/config.js';

const P = UI_PERMISSION;

function navItem(to, labelKey, icon, permission) {
  return { to, labelKey, icon, permission };
}

const ROLE_NAV_PREFIX = {
  [ROLES.INSTRUCTOR]: 'instructor',
  [ROLES.STUDENT]: 'student',
  [ROLES.UNIVERSITY_REVIEWER]: 'reviewer',
};

/** Non-admin roles — `{ to, labelKey, icon, permission }`. */
export const NAV_BY_ROLE = {
  [ROLES.INSTRUCTOR]: [
    navItem('/instructor/dashboard', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/instructor/cohorts', 'cohorts', Layers, P.canManageCohorts),
    navItem('/instructor/sessions', 'sessions', CalendarDays, P.canManageSessions),
    navItem('/instructor/attendance', 'attendance', ClipboardCheck, P.canManageAttendance),
    navItem('/instructor/assessments', 'assessments', FileCheck, P.canViewAssessments),
    navItem('/instructor/submissions', 'submissions', Upload, P.canViewSubmissionsTeaching),
    navItem('/instructor/grades', 'grades', BarChart3, P.canViewGradesTeaching),
    navItem('/instructor/evidence', 'evidence', FolderOpen, P.canUploadEvidence),
    navItem('/instructor/risk-students', 'riskStudents', AlertTriangle, P.canManageRiskStudents),
    navItem('/instructor/notifications', 'notifications', Bell, P.canViewNotifications),
  ],

  [ROLES.STUDENT]: [
    navItem('/student/dashboard', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/student/programs', 'programs', GraduationCap, P.canViewEnrolledPrograms),
    navItem('/student/content', 'content', BookOpen, P.canViewContent),
    navItem('/student/sessions', 'sessions', CalendarDays, P.canViewSessions),
    navItem('/student/attendance', 'attendance', ClipboardCheck, P.canViewAttendance),
    navItem('/student/assessments', 'assessments', FileCheck, P.canViewAssessments),
    navItem('/student/submissions', 'submissions', Upload, P.canViewSubmissionStatus),
    navItem('/student/grades', 'grades', BarChart3, P.canViewGrades),
    navItem('/student/certificate', 'certificate', Award, P.canViewCertificates),
    navItem('/student/notifications', 'notifications', Bell, P.canViewNotifications),
  ],

  [ROLES.UNIVERSITY_REVIEWER]: [
    navItem('/reviewer/dashboard', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/reviewer/recognition-requests', 'recognition', FileBadge, P.canViewRecognitionRequests),
    navItem('/reviewer/university-reports', 'universityReports', BarChart3, P.canViewUniversityReports),
    navItem('/reviewer/evidence', 'evidence', FolderOpen, P.canViewReviewerEvidence),
    navItem('/reviewer/certificates', 'certificates', Award, P.canViewLinkedCertificates),
    navItem('/reviewer/notifications', 'notifications', Bell, P.canViewNotifications),
  ],
};

function filterNavItemsByUi(user, items) {
  if (!items) return [];
  return items.filter((item) => hasUiPermissionForUser(user, item.permission));
}

function resolveRoleNavLabel(role, item, tNav) {
  const prefix = ROLE_NAV_PREFIX[role];
  if (!prefix) return item.labelKey;
  return tNav(`${prefix}.${item.labelKey}`);
}

/**
 * Unified sidebar: admin groups unchanged; other roles filtered by UI permissions.
 * @param {{ role?: string, permissions?: string[] } | null | undefined} user
 * @param {Function} tNav - `useTranslation('navigation').t`
 */
export function getDashboardNavGroups(user, tNav) {
  const role = user?.role;
  if (!role) return [];
  if (ADMIN_ROLE_SET.includes(role)) {
    return getAdminNavGroupsForRole(role, tNav);
  }
  const items = filterNavItemsByUi(user, NAV_BY_ROLE[role]).map((item) => ({
    ...item,
    label: resolveRoleNavLabel(role, item, tNav),
  }));
  if (!items.length) return [];
  return [{ id: 'main', title: tNav('mainMenu'), items }];
}

export function getNavItemsForRole(role, tNav, user = null) {
  if (role && ADMIN_ROLE_SET.includes(role)) {
    return flattenAdminNavItems(role, tNav);
  }
  const u = user && user.role === role ? user : { role };
  return filterNavItemsByUi(u, NAV_BY_ROLE[role] ?? NAV_BY_ROLE[ROLES.STUDENT]).map((item) => ({
    ...item,
    label: resolveRoleNavLabel(role, item, tNav),
  }));
}

/** Admin path segment → i18n namespace for CRUD titles */
const CRUD_MODULE_NS = {
  users: 'users',
  universities: 'universities',
  tracks: 'tracks',
  'learning-outcomes': 'learningOutcomes',
  'micro-credentials': 'microCredentials',
  cohorts: 'cohorts',
  assessments: 'assessments',
  'recognition-requests': 'recognition',
};

function crudPageTitle(parts, ns) {
  const lng = i18n.language;
  const tf = i18n.getFixedT(lng, ns);
  const tCommon = i18n.getFixedT(lng, 'common');

  if (parts.length === 2) return tf('title');

  if (parts[2] === 'create') {
    const full = tf('create.title', { defaultValue: '' });
    return full || `${tf('title')} — ${tCommon('actions.add')}`;
  }

  if (parts.length >= 4 && parts[3] === 'edit') {
    const full = tf('edit.title', { defaultValue: '' });
    return full || `${tf('title')} — ${tCommon('actions.edit')}`;
  }

  if (parts.length === 3 && parts[2] !== 'create') {
    const full = tf('view.title', { defaultValue: '' });
    return full || `${tf('title')} — ${tCommon('actions.details')}`;
  }

  return tf('title');
}

function matchCrudTitle(pathname) {
  const clean = pathname.replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] !== 'admin') return null;
  const mod = parts[1];
  const ns = CRUD_MODULE_NS[mod];
  if (!ns) return null;
  return crudPageTitle(parts, ns);
}

export function getPageTitleForPath(role, pathname, user = null) {
  const lng = i18n.language;
  const tCommon = i18n.getFixedT(lng, 'common');
  const tAssess = i18n.getFixedT(lng, 'assessments');

  const crud = matchCrudTitle(pathname);
  if (crud) return crud;

  if (pathname.includes('/instructor/assessments/create')) return tAssess('create.title');
  if (/\/instructor\/assessments\/.+\/edit/.test(pathname)) return tAssess('edit.title');

  const tNav = i18n.getFixedT(lng, 'navigation');
  const items = getNavItemsForRole(role, tNav, user ?? (role ? { role } : null));
  const exact = items.find((n) => n.to === pathname);
  if (exact) return exact.label;

  const sorted = [...items].sort((a, b) => b.to.length - a.to.length);
  const prefix = sorted.find((n) => pathname.startsWith(`${n.to}/`));
  if (prefix) return prefix.label;

  return tCommon('brand');
}

export function canAccessPath(user, pathname) {
  const role = user?.role;
  if (!role) return false;
  if (ADMIN_ROLE_SET.includes(role)) {
    const paths = flattenAdminNavPaths(role);
    return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  if (!canAccessPathWithUiPermissionsForUser(user, pathname)) return false;
  const tNav = i18n.getFixedT(i18n.language, 'navigation');
  const items = getNavItemsForRole(role, tNav, user);
  return items.some((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
}
