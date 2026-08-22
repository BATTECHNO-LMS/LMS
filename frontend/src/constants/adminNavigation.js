import {
  LayoutDashboard,
  Users,
  Shield,
  Building2,
  Route,
  GraduationCap,
  ListTree,
  Layers,
  BookOpen,
  BookMarked,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  ListChecks,
  Upload,
  BarChart3,
  FolderOpen,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  BadgeAlert,
  FileBadge,
  Award,
  FileSpreadsheet,
  ScrollText,
  Settings,
  HeartPulse,
  LineChart,
  Bell,
  UserPlus,
  BookOpenCheck,
  Map,
  MessageSquare,
  Megaphone,
  CircleHelp,
  History,
  Send,
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
    id: 'general',
    titleKey: 'admin.groups.general',
    items: [
      entry('/admin/dashboard', 'admin.items.dashboard', LayoutDashboard, [S, Ad]),
      entry('/admin/notifications', 'admin.items.notifications', Bell, [S, Ad]),
      entry('/admin/analytics', 'admin.items.analytics', LineChart, [S]),
      entry('/admin/courses', 'admin.items.courses', BookMarked, [S], { portal: 'UNIVERSITY' }),
      entry('/admin/field-training', 'admin.items.fieldTraining', Briefcase, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/field-training/reports', 'admin.items.fieldTrainingReports', Briefcase, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/field-training/reports/students', 'admin.items.fieldTrainingStudents', Users, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/institutions', 'admin.items.institutions', Building2, [S, Ad], {
        portal: 'INSTITUTION',
      }),
      entry('/admin/users', 'admin.items.users', Users, [S, Ad]),
      entry('/admin/roles-permissions', 'admin.items.roles', Shield, [S]),
      entry('/admin/settings', 'admin.items.settings', Settings, [S]),
    ],
  },
  {
    id: 'institutionTraining',
    titleKey: 'admin.groups.institutionTraining',
    portal: 'INSTITUTION',
    collapsible: true,
    defaultOpen: true,
    items: [
      entry('/admin/training-courses', 'admin.items.trainingCourses', BookOpen, [S, Ad], {
        portal: 'INSTITUTION',
      }),
    ],
  },
  {
    id: 'contentHelp',
    titleKey: 'admin.groups.contentHelp',
    items: [
      entry('/admin/content-hub/help', 'admin.items.contentHubHelp', BookOpenCheck, [S, Ad]),
      entry('/admin/content-hub/tours', 'admin.items.contentHubTours', Map, [S, Ad]),
      entry('/admin/content-hub/popups', 'admin.items.contentHubPopups', MessageSquare, [S, Ad]),
      entry('/admin/content-hub/announcements', 'admin.items.contentHubAnnouncements', Megaphone, [S, Ad]),
      entry('/admin/content-hub/notifications', 'admin.items.contentHubNotifications', Bell, [S, Ad]),
      entry('/admin/content-hub/notifications/send', 'admin.items.contentHubNotificationsSend', Send, [S, Ad]),
      entry('/admin/content-hub/contextual', 'admin.items.contentHubContextual', CircleHelp, [S, Ad]),
      entry('/admin/content-hub/analytics', 'admin.items.contentHubAnalytics', BarChart3, [S, Ad]),
      entry('/admin/content-hub/audit', 'admin.items.contentHubAudit', History, [S, Ad]),
    ],
  },
  {
    id: 'orgs',
    titleKey: 'admin.groups.orgs',
    portal: 'UNIVERSITY',
    items: [
      entry('/admin/universities', 'admin.items.universities', Building2, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/tracks', 'admin.items.tracks', Route, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/learning-outcomes', 'admin.items.learningOutcomes', ListTree, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/cohorts', 'admin.items.cohorts', Layers, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/enrollments', 'admin.items.enrollments', UserPlus, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/content', 'admin.items.content', BookOpen, [S, Ad], { portal: 'UNIVERSITY' }),
    ],
  },
  {
    id: 'delivery',
    titleKey: 'admin.groups.delivery',
    portal: 'UNIVERSITY',
    items: [
      entry('/admin/sessions', 'admin.items.sessions', CalendarDays, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/attendance', 'admin.items.attendance', ClipboardCheck, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/assessments', 'admin.items.assessments', FileCheck, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/rubrics', 'admin.items.rubrics', ListChecks, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/submissions', 'admin.items.submissions', Upload, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/grades', 'admin.items.grades', BarChart3, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/evidence', 'admin.items.evidence', FolderOpen, [S, Ad], { portal: 'UNIVERSITY' }),
    ],
  },
  {
    id: 'quality',
    titleKey: 'admin.groups.quality',
    portal: 'UNIVERSITY',
    items: [
      entry('/admin/qa', 'admin.items.qa', HeartPulse, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/qa-reviews', 'admin.items.qaReviews', ShieldCheck, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/corrective-actions', 'admin.items.correctiveActions', ClipboardList, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/at-risk-students', 'admin.items.atRiskStudents', AlertTriangle, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/risk-cases', 'admin.items.riskCases', AlertTriangle, [S, Ad], { portal: 'UNIVERSITY' }),
      entry('/admin/integrity-cases', 'admin.items.integrity', BadgeAlert, [S, Ad], { portal: 'UNIVERSITY' }),
    ],
  },
  {
    id: 'accreditation',
    titleKey: 'admin.groups.accreditation',
    items: [
      entry('/admin/recognition-requests', 'admin.items.recognition', FileBadge, [S, Ad], {
        portal: 'UNIVERSITY',
      }),
      entry('/admin/certificates', 'admin.items.certificates', Award, [S, Ad]),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [S, Ad]),
      entry('/admin/audit-logs', 'admin.items.auditLogs', ScrollText, [S]),
    ],
  },
];

function isGlobalAdmin(user) {
  return Boolean(user?.isGlobal || canonicalizeRoleCode(user?.role) === ROLES.SUPER_ADMIN);
}

function itemVisibleForPortal(item, organizationType, global) {
  if (!item.portal) return true;
  if (global) {
    // Super admin sees both portals; hide duplicate institutions link in institution group.
    if (item.hideForSuperAdmin) return false;
    return true;
  }
  if (!organizationType) return item.portal !== 'INSTITUTION';
  return item.portal === organizationType;
}

function groupVisibleForPortal(group, organizationType, global) {
  if (!group.portal) return true;
  if (global) return true;
  if (!organizationType) return group.portal !== 'INSTITUTION';
  return group.portal === organizationType;
}

export function getAdminNavGroupsForRole(role, t, user = null) {
  if (isLegacyDeprecatedRole(role)) return [];
  const canonical = canonicalizeRoleCode(role);
  const global = isGlobalAdmin(user || { role: canonical });
  const organizationType = user?.organizationType || null;

  return ADMIN_NAV_GROUPS.map((group) => {
    if (!groupVisibleForPortal(group, organizationType, global)) {
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

/** Route paths only — for access checks without translation. */
export function flattenAdminNavPaths(role, user = null) {
  if (isLegacyDeprecatedRole(role)) return [];
  const canonical = canonicalizeRoleCode(role);
  const global = isGlobalAdmin(user || { role: canonical });
  const organizationType = user?.organizationType || null;
  return ADMIN_NAV_GROUPS.filter((g) => groupVisibleForPortal(g, organizationType, global)).flatMap((g) =>
    g.items
      .filter((i) => i.roles.includes(canonical))
      .filter((i) => itemVisibleForPortal(i, organizationType, global))
      .map((i) => i.to)
  );
}

