import {
  LayoutDashboard,
  Users,
  Shield,
  Building2,
  GraduationCap,
  BookOpen,
  Briefcase,
  Award,
  FileSpreadsheet,
  ScrollText,
  Settings,
  Bell,
  BookOpenCheck,
} from 'lucide-react';
import { ROLES, canonicalizeRoleCode, isLegacyDeprecatedRole } from './roles.js';

const S = ROLES.SUPER_ADMIN;
const Ad = ROLES.ADMIN;

/** All admin-shell roles */
export const ADMIN_SHELL_ROLES = [S, Ad];

function entry(to, labelKey, icon, roles, meta = {}) {
  return { to, labelKey, icon, roles, ...meta };
}

/**
 * Grouped navigation — labels resolved via `t` from namespace `navigation`.
 * Item visibility for Admin is further narrowed by organization type.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'main',
    titleKey: 'admin.groups.main',
    items: [
      entry('/admin/dashboard', 'admin.items.dashboard', LayoutDashboard, [S, Ad]),
      entry('/admin/training-courses', 'admin.items.trainingCourses', BookOpen, [Ad]),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [Ad]),
      entry('/admin/field-training', 'admin.items.fieldTraining', Briefcase, [Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/users?role=student', 'admin.items.students', Users, [Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/users?role=instructor', 'admin.items.instructors', Users, [Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/users?role=trainee', 'admin.items.trainees', Users, [Ad], { portal: 'INSTITUTION' }),
      entry('/admin/users?role=trainer', 'admin.items.trainers', Users, [Ad], { portal: 'INSTITUTION' }),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [Ad]),
      entry('/admin/certificates', 'admin.items.certificates', Award, [Ad]),
      entry('/admin/notifications', 'admin.items.notifications', Bell, [Ad]),
      entry('/admin/content-hub/help', 'admin.items.help', BookOpenCheck, [Ad]),
    ],
  },
  {
    id: 'organizations',
    titleKey: 'admin.groups.organizations',
    roles: [S],
    items: [
      entry('/admin/universities', 'admin.items.universities', Building2, [S]),
      entry('/admin/institutions', 'admin.items.institutions', Building2, [S]),
    ],
  },
  {
    id: 'training',
    titleKey: 'admin.groups.training',
    roles: [S],
    items: [
      entry('/admin/training-courses', 'admin.items.trainingCourses', BookOpen, [S]),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [S]),
      entry('/admin/field-training', 'admin.items.fieldTraining', Briefcase, [S]),
    ],
  },
  {
    id: 'platform',
    titleKey: 'admin.groups.platform',
    roles: [S],
    items: [
      entry('/admin/users', 'admin.items.users', Users, [S]),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [S]),
      entry('/admin/certificates', 'admin.items.certificates', Award, [S]),
      entry('/admin/notifications', 'admin.items.notifications', Bell, [S]),
      entry('/admin/audit-logs', 'admin.items.auditLogs', ScrollText, [S]),
      entry('/admin/settings', 'admin.items.settings', Settings, [S]),
      entry('/admin/roles-permissions', 'admin.items.roles', Shield, [S]),
      entry('/admin/content-hub/help', 'admin.items.help', BookOpenCheck, [S]),
    ],
  },
];

/**
 * Hidden operational prefixes still required by Courses / Micro-Credentials / Field Training.
 * These are not shown in the simplified sidebar.
 */
const ADMIN_EXTRA_PATH_PREFIXES = {
  shared: [
    '/admin/dashboard',
    '/admin/notifications',
    '/admin/notification-settings',
    '/admin/certificates',
    '/admin/reports',
    '/admin/training-courses',
    '/admin/micro-credentials',
    '/admin/content-hub',
    '/admin/users',
    '/admin/help',
  ],
  university: [
    '/admin/field-training',
    '/admin/tracks',
    '/admin/learning-outcomes',
    '/admin/cohorts',
    '/admin/enrollments',
    '/admin/content',
    '/admin/sessions',
    '/admin/attendance',
    '/admin/assessments',
    '/admin/rubrics',
    '/admin/submissions',
    '/admin/grades',
    '/admin/universities',
  ],
  super: [
    '/admin/analytics',
    '/admin/courses',
    '/admin/audit-logs',
    '/admin/settings',
    '/admin/roles-permissions',
    '/admin/institutions',
    '/admin/universities',
    '/admin/field-training',
  ],
};

function isGlobalAdmin(user) {
  return Boolean(user?.isGlobal || canonicalizeRoleCode(user?.role) === ROLES.SUPER_ADMIN);
}

function itemVisibleForPortal(item, organizationType, global) {
  if (!item.portal) return true;
  if (global) {
    if (item.hideForSuperAdmin) return false;
    return true;
  }
  if (!organizationType) return item.portal !== 'INSTITUTION';
  return item.portal === organizationType;
}

function groupVisibleForPortal(group, organizationType, global, role) {
  if (Array.isArray(group.roles) && role && !group.roles.includes(role)) return false;
  if (!group.portal) return true;
  if (global) return true;
  if (!organizationType) return group.portal !== 'INSTITUTION';
  return group.portal === organizationType;
}

function extraPathPrefixesForUser(user, role) {
  const global = isGlobalAdmin(user || { role });
  const organizationType = user?.organizationType || null;
  const prefixes = [...ADMIN_EXTRA_PATH_PREFIXES.shared];
  if (global) {
    prefixes.push(...ADMIN_EXTRA_PATH_PREFIXES.university, ...ADMIN_EXTRA_PATH_PREFIXES.super);
  } else if (organizationType === 'UNIVERSITY' || !organizationType) {
    prefixes.push(...ADMIN_EXTRA_PATH_PREFIXES.university);
  }
  return [...new Set(prefixes)];
}

export function getAdminNavGroupsForRole(role, t, user = null) {
  if (isLegacyDeprecatedRole(role)) return [];
  const canonical = canonicalizeRoleCode(role);
  const global = isGlobalAdmin(user || { role: canonical });
  const organizationType = user?.organizationType || null;

  return ADMIN_NAV_GROUPS.map((group) => {
    if (!groupVisibleForPortal(group, organizationType, global, canonical)) {
      return { id: group.id, title: t(group.titleKey), items: [] };
    }
    return {
      id: group.id,
      title: t(group.titleKey),
      collapsible: Boolean(group.collapsible),
      defaultOpen: Boolean(group.defaultOpen),
      items: group.items
        .filter((item) => item.roles.includes(canonical))
        .filter((item) => itemVisibleForPortal(item, organizationType, global))
        .map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
    };
  }).filter((g) => g.items.length > 0);
}

export function flattenAdminNavItems(role, t, user = null) {
  return getAdminNavGroupsForRole(role, t, user).flatMap((g) => g.items);
}

function navPathBase(to) {
  return String(to || '').split('?')[0];
}

/** Route paths only — for access checks without translation. */
export function flattenAdminNavPaths(role, user = null) {
  if (isLegacyDeprecatedRole(role)) return [];
  const canonical = canonicalizeRoleCode(role);
  const global = isGlobalAdmin(user || { role: canonical });
  const organizationType = user?.organizationType || null;
  const fromNav = ADMIN_NAV_GROUPS.filter((g) =>
    groupVisibleForPortal(g, organizationType, global, canonical)
  ).flatMap((g) =>
    g.items
      .filter((i) => i.roles.includes(canonical))
      .filter((i) => itemVisibleForPortal(i, organizationType, global))
      .map((i) => navPathBase(i.to))
  );
  return [...new Set([...fromNav, ...extraPathPrefixesForUser(user, canonical)])];
}
