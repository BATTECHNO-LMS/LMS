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
  BookMarked,
  Briefcase,
  Award,
  FileBadge,
  Bell,
  Library,
  Table2,
  Users,
  ListChecks,
  ClipboardList,
  BookOpenCheck,
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
  [ROLES.TRAINER]: 'trainer',
  [ROLES.TRAINEE]: 'trainee',
  [ROLES.STUDENT]: 'student',
  [ROLES.REVIEWER]: 'reviewer',
};

/**
 * Student sidebar sections — field training first, then learning / support.
 * Each group can be collapsible in AdminSidebar when `collapsible: true`.
 */
export const STUDENT_NAV_GROUPS = [
  {
    id: 'overview',
    titleKey: 'student.groups.overview',
    collapsible: false,
    defaultOpen: true,
    items: [navItem('/student/dashboard', 'home', LayoutDashboard, P.canViewDashboard)],
  },
  {
    id: 'fieldTraining',
    titleKey: 'student.groups.fieldTraining',
    collapsible: true,
    defaultOpen: true,
    items: [
      navItem('/student/field-training', 'fieldTraining', Briefcase, P.canViewFieldTraining),
      navItem('/student/sessions', 'sessions', CalendarDays, P.canViewSessions),
      navItem('/student/attendance', 'attendance', ClipboardCheck, P.canViewAttendance),
      navItem('/student/assessments', 'assessments', FileCheck, P.canViewAssessments),
      navItem('/student/submissions', 'submissions', Upload, P.canViewSubmissionStatus),
      navItem('/student/grades', 'grades', BarChart3, P.canViewGrades),
      navItem('/student/certificate', 'certificate', Award, P.canViewCertificates),
    ],
  },
  {
    id: 'learning',
    titleKey: 'student.groups.learning',
    collapsible: true,
    defaultOpen: false,
    items: [
      navItem('/student/training-programs', 'trainingPrograms', Briefcase, P.canViewEnrolledPrograms),
      navItem('/student/available-cohorts', 'availableCohorts', Library, P.canViewEnrolledPrograms),
      navItem('/student/courses', 'courses', BookMarked, P.canViewCourses),
      navItem('/student/programs', 'programs', GraduationCap, P.canViewEnrolledPrograms),
      navItem('/student/semester-schedule', 'semesterSchedule', Table2, P.canViewEnrolledPrograms),
      navItem('/student/content', 'content', BookOpen, P.canViewContent),
    ],
  },
  {
    id: 'support',
    titleKey: 'student.groups.support',
    collapsible: true,
    defaultOpen: false,
    items: [
      navItem('/student/user-guide', 'userGuide', BookOpenCheck),
      navItem('/student/notifications', 'notifications', Bell, P.canViewNotifications),
    ],
  },
];

function flattenStudentNavItems() {
  return STUDENT_NAV_GROUPS.flatMap((g) => g.items);
}

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
    navItem('/instructor/field-training', 'fieldTraining', Briefcase),
    navItem('/instructor/field-training', 'fieldTrainingAssigned', Users),
    navItem('/instructor/field-training?section=sessions', 'fieldTrainingSessions', CalendarDays),
    navItem('/instructor/field-training?section=tasks', 'fieldTrainingTasks', ListChecks),
    navItem('/instructor/field-training?section=results', 'fieldTrainingResults', ClipboardList),
    navItem('/instructor/field-training?section=eligibility', 'fieldTrainingEligibility', Award),
    navItem('/instructor/user-guide', 'userGuide', BookOpenCheck),
    navItem('/instructor/notifications', 'notifications', Bell, P.canViewNotifications),
  ],

  [ROLES.TRAINER]: [
    navItem('/trainer', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/trainer/courses', 'courses', BookOpen, P.canViewDashboard),
    navItem('/trainer/notifications', 'notifications', Bell, P.canViewNotifications),
    navItem('/trainer/user-guide', 'userGuide', BookOpenCheck, P.canViewDashboard),
    navItem('/trainer/profile', 'profile', Users, P.canViewDashboard),
  ],

  [ROLES.TRAINEE]: [
    navItem('/trainee', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/trainee/courses', 'courses', BookOpen, P.canViewEnrolledPrograms),
    navItem('/trainee/certificates', 'certificates', Award, P.canViewCertificates),
    navItem('/trainee/notifications', 'notifications', Bell, P.canViewNotifications),
    navItem('/trainee/user-guide', 'userGuide', BookOpenCheck, P.canViewDashboard),
    navItem('/trainee/user-guide/support', 'support', BookOpenCheck, P.canViewDashboard),
    navItem('/trainee/profile', 'profile', Users, P.canViewDashboard),
  ],

  [ROLES.STUDENT]: flattenStudentNavItems(),

  [ROLES.REVIEWER]: [
    navItem('/reviewer/dashboard', 'home', LayoutDashboard, P.canViewDashboard),
    navItem('/reviewer/field-training/reports', 'fieldTrainingReports', Briefcase, P.canViewUniversityReports),
    navItem('/reviewer/field-training/reports/students', 'fieldTrainingStudents', Users, P.canViewUniversityReports),
    navItem('/academic/field-training/opportunities', 'fieldTrainingOpportunities', Briefcase, P.canViewUniversityReports),
    navItem('/reviewer/university-reports', 'universityReports', BarChart3, P.canViewUniversityReports),
    navItem('/reviewer/certificates', 'certificates', Award, P.canViewLinkedCertificates),
    navItem('/reviewer/enrollment-requests', 'enrollmentRequests', Library, P.canViewUniversityReports),
    navItem('/reviewer/recognition-requests', 'recognition', FileBadge, P.canViewRecognitionRequests),
    navItem('/reviewer/evidence', 'evidence', FolderOpen, P.canViewReviewerEvidence),
    navItem('/reviewer/user-guide', 'userGuide', BookOpenCheck, P.canViewDashboard),
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
 * Unified sidebar: admin groups unchanged; student uses collapsible sections;
 * other roles filtered by UI permissions into a single group.
 * @param {{ role?: string, permissions?: string[] } | null | undefined} user
 * @param {Function} tNav - `useTranslation('navigation').t`
 */
function applyInstitutionLabelOverrides(role, items, organizationType) {
  if (organizationType !== 'INSTITUTION') return items;
  const overrides = {
    [ROLES.TRAINEE]: {
      home: 'لوحة التحكم',
      courses: 'دوراتي التدريبية',
      certificates: 'الشهادات',
      notifications: 'الإشعارات',
      userGuide: 'دليل المتدرب',
      support: 'الدعم',
      profile: 'الملف الشخصي',
    },
    [ROLES.STUDENT]: {
      home: 'لوحة المتدرب',
      trainingPrograms: 'الدورات التدريبية',
      availableCohorts: 'الدفعات',
      fieldTraining: 'الدورات التدريبية',
      sessions: 'الجلسات',
      attendance: 'الحضور',
      assessments: 'الاختبارات',
      submissions: 'المهمات',
      grades: 'التقدم والساعات',
      certificate: 'الشهادات',
    },
    [ROLES.TRAINER]: {
      home: 'لوحة التحكم',
      courses: 'الدورات التدريبية',
      notifications: 'الإشعارات',
      userGuide: 'دليل المدرب',
      profile: 'الملف الشخصي',
    },
    [ROLES.INSTRUCTOR]: {
      home: 'لوحة المدرب',
      cohorts: 'الدفعات',
      sessions: 'الجلسات',
      attendance: 'الحضور',
      assessments: 'الاختبارات',
      submissions: 'المهمات',
      grades: 'التقدم والساعات',
      fieldTraining: 'الدورات التدريبية',
      fieldTrainingAssigned: 'دوراتي المسندة',
      fieldTrainingSessions: 'الجلسات والحضور',
      fieldTrainingTasks: 'المهمات والتسليمات',
      fieldTrainingResults: 'نتائج المتدربين',
    },
    [ROLES.REVIEWER]: {
      home: 'لوحة مراجع المؤسسة',
      universityReports: 'تقارير المؤسسة',
      fieldTraining: 'التقدم والساعات',
      fieldTrainingStudents: 'المتدربون',
      fieldTrainingOpportunities: 'الدورات التدريبية',
      certificates: 'الشهادات',
    },
  };
  const map = overrides[role] || {};
  return items.map((item) =>
    map[item.labelKey] ? { ...item, label: map[item.labelKey] } : item
  );
}

export function getDashboardNavGroups(user, tNav) {
  const role = user?.role;
  if (!role) return [];
  if (ADMIN_ROLE_SET.includes(role)) {
    return getAdminNavGroupsForRole(role, tNav, user);
  }
  // Institution learners use dedicated TRAINEE nav (not university student groups).
  if (role === ROLES.TRAINEE || (role === ROLES.STUDENT && user?.organizationType === 'INSTITUTION')) {
    const traineeRole = ROLES.TRAINEE;
    const items = applyInstitutionLabelOverrides(
      traineeRole,
      filterNavItemsByUi(
        { ...user, role: traineeRole },
        NAV_BY_ROLE[ROLES.TRAINEE]
      ).map((item) => ({
        ...item,
        label: resolveRoleNavLabel(traineeRole, item, tNav),
      })),
      'INSTITUTION'
    );
    return items.length ? [{ id: 'main', title: tNav('mainMenu'), items }] : [];
  }

  if (role === ROLES.STUDENT) {
    const groups = STUDENT_NAV_GROUPS;

    return groups
      .map((group) => ({
        id: group.id,
        title: tNav(group.titleKey),
        collapsible: Boolean(group.collapsible),
        defaultOpen: Boolean(group.defaultOpen),
        items: applyInstitutionLabelOverrides(
          role,
          filterNavItemsByUi(user, group.items).map((item) => ({
            ...item,
            label: resolveRoleNavLabel(role, item, tNav),
          })),
          user?.organizationType
        ),
      }))
      .filter((group) => group.items.length > 0);
  }
  const items = applyInstitutionLabelOverrides(
    role,
    filterNavItemsByUi(user, NAV_BY_ROLE[role]).map((item) => ({
      ...item,
      label: resolveRoleNavLabel(role, item, tNav),
    })),
    user?.organizationType
  );
  if (!items.length) return [];
  return [{ id: 'main', title: tNav('mainMenu'), items }];
}

export function getNavItemsForRole(role, tNav, user = null) {
  if (role && ADMIN_ROLE_SET.includes(role)) {
    return flattenAdminNavItems(role, tNav, user);
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
    const paths = flattenAdminNavPaths(role, user);
    return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  if (!canAccessPathWithUiPermissionsForUser(user, pathname)) return false;
  const tNav = i18n.getFixedT(i18n.language, 'navigation');
  const items = getNavItemsForRole(role, tNav, user);
  return items.some((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
}
