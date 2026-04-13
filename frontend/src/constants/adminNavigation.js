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
} from 'lucide-react';
import { ROLES } from './roles.js';

const S = ROLES.SUPER_ADMIN;
const P = ROLES.PROGRAM_ADMIN;
const U = ROLES.UNIVERSITY_ADMIN;
const A = ROLES.ACADEMIC_ADMIN;
const Q = ROLES.QA_OFFICER;

/** All admin-shell roles */
export const ADMIN_SHELL_ROLES = [S, P, U, A, Q];

function entry(to, labelKey, icon, roles) {
  return { to, labelKey, icon, roles };
}

/**
 * Grouped navigation — labels resolved via `t` from namespace `navigation`.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'general',
    titleKey: 'admin.groups.general',
    items: [
      entry('/admin/dashboard', 'admin.items.dashboard', LayoutDashboard, [S, P, U, A, Q]),
      entry('/admin/notifications', 'admin.items.notifications', Bell, [S, P, U, A, Q]),
      entry('/admin/analytics', 'admin.items.analytics', LineChart, [S]),
      entry('/admin/users', 'admin.items.users', Users, [S, P, U]),
      entry('/admin/roles-permissions', 'admin.items.roles', Shield, [S]),
      entry('/admin/settings', 'admin.items.settings', Settings, [S]),
    ],
  },
  {
    id: 'orgs',
    titleKey: 'admin.groups.orgs',
    items: [
      entry('/admin/universities', 'admin.items.universities', Building2, [S, P, U]),
      entry('/admin/tracks', 'admin.items.tracks', Route, [S, P, U, A]),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [S, U, A]),
      entry('/admin/learning-outcomes', 'admin.items.learningOutcomes', ListTree, [S, U, A]),
      entry('/admin/cohorts', 'admin.items.cohorts', Layers, [S, P, U, A]),
      entry('/admin/content', 'admin.items.content', BookOpen, [S, P, U, A]),
    ],
  },
  {
    id: 'delivery',
    titleKey: 'admin.groups.delivery',
    items: [
      entry('/admin/sessions', 'admin.items.sessions', CalendarDays, [S, P, U, A, Q]),
      entry('/admin/attendance', 'admin.items.attendance', ClipboardCheck, [S, P, U, A, Q]),
      entry('/admin/assessments', 'admin.items.assessments', FileCheck, [S, U, A, Q]),
      entry('/admin/rubrics', 'admin.items.rubrics', ListChecks, [S, U, A]),
      entry('/admin/submissions', 'admin.items.submissions', Upload, [S, P, U, A]),
      entry('/admin/grades', 'admin.items.grades', BarChart3, [S, P, U, A]),
      entry('/admin/evidence', 'admin.items.evidence', FolderOpen, [S, P, U, A, Q]),
    ],
  },
  {
    id: 'quality',
    titleKey: 'admin.groups.quality',
    items: [
      entry('/admin/qa', 'admin.items.qa', HeartPulse, [S, P, U, A, Q]),
      entry('/admin/qa-reviews', 'admin.items.qaReviews', ShieldCheck, [S, P, U, A, Q]),
      entry('/admin/corrective-actions', 'admin.items.correctiveActions', ClipboardList, [S, P, U, A, Q]),
      entry('/admin/at-risk-students', 'admin.items.atRiskStudents', AlertTriangle, [S, P, U, A, Q]),
      entry('/admin/risk-cases', 'admin.items.riskCases', AlertTriangle, [S, P, U, A, Q]),
      entry('/admin/integrity-cases', 'admin.items.integrity', BadgeAlert, [S, P, U, A, Q]),
    ],
  },
  {
    id: 'accreditation',
    titleKey: 'admin.groups.accreditation',
    items: [
      entry('/admin/recognition-requests', 'admin.items.recognition', FileBadge, [S, P, U, A]),
      entry('/admin/certificates', 'admin.items.certificates', Award, [S, P, U, A]),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [S, P, U, A, Q]),
      entry('/admin/audit-logs', 'admin.items.auditLogs', ScrollText, [S, P, U, A]),
    ],
  },
];

export function getAdminNavGroupsForRole(role, t) {
  return ADMIN_NAV_GROUPS.map((group) => ({
    id: group.id,
    title: t(group.titleKey),
    items: group.items
      .filter((item) => item.roles.includes(role))
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
  return ADMIN_NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.roles.includes(role)).map((i) => i.to));
}
