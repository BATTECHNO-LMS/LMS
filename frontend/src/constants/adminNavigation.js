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
} from 'lucide-react';
import { ROLES, canonicalizeRoleCode } from './roles.js';

const S = ROLES.SUPER_ADMIN;
const Ad = ROLES.ADMIN;

/** All admin-shell roles */
export const ADMIN_SHELL_ROLES = [S, Ad];

function entry(to, labelKey, icon, roles) {
  return { to, labelKey, icon, roles };
}

/**
 * Grouped navigation — labels resolved via `t` from namespace `navigation`.
 * Item visibility for Admin is further narrowed by UI permissions / backend later.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'general',
    titleKey: 'admin.groups.general',
    items: [
      entry('/admin/dashboard', 'admin.items.dashboard', LayoutDashboard, [S, Ad]),
      entry('/admin/notifications', 'admin.items.notifications', Bell, [S, Ad]),
      entry('/admin/analytics', 'admin.items.analytics', LineChart, [S]),
      entry('/admin/courses', 'admin.items.courses', BookMarked, [S, Ad]),
      entry('/admin/field-training', 'admin.items.fieldTraining', Briefcase, [S, Ad]),
      entry('/admin/help', 'admin.items.userGuide', BookOpenCheck, [S]),
      entry('/admin/field-training/reports', 'admin.items.fieldTrainingReports', Briefcase, [S, Ad]),
      entry('/admin/field-training/reports/students', 'admin.items.fieldTrainingStudents', Users, [S, Ad]),
      entry('/admin/users', 'admin.items.users', Users, [S, Ad]),
      entry('/admin/roles-permissions', 'admin.items.roles', Shield, [S]),
      entry('/admin/settings', 'admin.items.settings', Settings, [S]),
    ],
  },
  {
    id: 'orgs',
    titleKey: 'admin.groups.orgs',
    items: [
      entry('/admin/universities', 'admin.items.universities', Building2, [S, Ad]),
      entry('/admin/tracks', 'admin.items.tracks', Route, [S, Ad]),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [S, Ad]),
      entry('/admin/learning-outcomes', 'admin.items.learningOutcomes', ListTree, [S, Ad]),
      entry('/admin/cohorts', 'admin.items.cohorts', Layers, [S, Ad]),
      entry('/admin/enrollments', 'admin.items.enrollments', UserPlus, [S, Ad]),
      entry('/admin/content', 'admin.items.content', BookOpen, [S, Ad]),
    ],
  },
  {
    id: 'delivery',
    titleKey: 'admin.groups.delivery',
    items: [
      entry('/admin/sessions', 'admin.items.sessions', CalendarDays, [S, Ad]),
      entry('/admin/attendance', 'admin.items.attendance', ClipboardCheck, [S, Ad]),
      entry('/admin/assessments', 'admin.items.assessments', FileCheck, [S, Ad]),
      entry('/admin/rubrics', 'admin.items.rubrics', ListChecks, [S, Ad]),
      entry('/admin/submissions', 'admin.items.submissions', Upload, [S, Ad]),
      entry('/admin/grades', 'admin.items.grades', BarChart3, [S, Ad]),
      entry('/admin/evidence', 'admin.items.evidence', FolderOpen, [S, Ad]),
    ],
  },
  {
    id: 'quality',
    titleKey: 'admin.groups.quality',
    items: [
      entry('/admin/qa', 'admin.items.qa', HeartPulse, [S, Ad]),
      entry('/admin/qa-reviews', 'admin.items.qaReviews', ShieldCheck, [S, Ad]),
      entry('/admin/corrective-actions', 'admin.items.correctiveActions', ClipboardList, [S, Ad]),
      entry('/admin/at-risk-students', 'admin.items.atRiskStudents', AlertTriangle, [S, Ad]),
      entry('/admin/risk-cases', 'admin.items.riskCases', AlertTriangle, [S, Ad]),
      entry('/admin/integrity-cases', 'admin.items.integrity', BadgeAlert, [S, Ad]),
    ],
  },
  {
    id: 'accreditation',
    titleKey: 'admin.groups.accreditation',
    items: [
      entry('/admin/recognition-requests', 'admin.items.recognition', FileBadge, [S, Ad]),
      entry('/admin/certificates', 'admin.items.certificates', Award, [S, Ad]),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [S, Ad]),
      entry('/admin/audit-logs', 'admin.items.auditLogs', ScrollText, [S, Ad]),
    ],
  },
];

export function getAdminNavGroupsForRole(role, t) {
  const canonical = canonicalizeRoleCode(role);
  return ADMIN_NAV_GROUPS.map((group) => ({
    id: group.id,
    title: t(group.titleKey),
    items: group.items
      .filter((item) => item.roles.includes(canonical))
      .map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
  })).filter((g) => g.items.length > 0);
}

export function flattenAdminNavItems(role, t) {
  return getAdminNavGroupsForRole(role, t).flatMap((g) => g.items);
}

/** Route paths only — for access checks without translation. */
export function flattenAdminNavPaths(role) {
  const canonical = canonicalizeRoleCode(role);
  return ADMIN_NAV_GROUPS.flatMap((g) =>
    g.items.filter((i) => i.roles.includes(canonical)).map((i) => i.to)
  );
}
