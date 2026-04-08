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
} from 'lucide-react';
import { ROLES } from './roles.js';

const S = ROLES.SUPER_ADMIN;
const P = ROLES.PROGRAM_ADMIN;
const A = ROLES.ACADEMIC_ADMIN;
const Q = ROLES.QA_OFFICER;

/** All admin-shell roles */
export const ADMIN_SHELL_ROLES = [S, P, A, Q];

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
      entry('/admin/dashboard', 'admin.items.dashboard', LayoutDashboard, [S, P, A, Q]),
      entry('/admin/analytics', 'admin.items.analytics', LineChart, [S]),
      entry('/admin/users', 'admin.items.users', Users, [S]),
      entry('/admin/roles-permissions', 'admin.items.roles', Shield, [S]),
      entry('/admin/settings', 'admin.items.settings', Settings, [S]),
    ],
  },
  {
    id: 'orgs',
    titleKey: 'admin.groups.orgs',
    items: [
      entry('/admin/universities', 'admin.items.universities', Building2, [S, P]),
      entry('/admin/tracks', 'admin.items.tracks', Route, [S, P, A]),
      entry('/admin/micro-credentials', 'admin.items.microCredentials', GraduationCap, [S, A]),
      entry('/admin/learning-outcomes', 'admin.items.learningOutcomes', ListTree, [S, A]),
      entry('/admin/cohorts', 'admin.items.cohorts', Layers, [S, P, A]),
      entry('/admin/content', 'admin.items.content', BookOpen, [S, P, A]),
    ],
  },
  {
    id: 'delivery',
    titleKey: 'admin.groups.delivery',
    items: [
      entry('/admin/sessions', 'admin.items.sessions', CalendarDays, [S, P, A, Q]),
      entry('/admin/attendance', 'admin.items.attendance', ClipboardCheck, [S, P, A, Q]),
      entry('/admin/assessments', 'admin.items.assessments', FileCheck, [S, A, Q]),
      entry('/admin/rubrics', 'admin.items.rubrics', ListChecks, [S, A]),
      entry('/admin/submissions', 'admin.items.submissions', Upload, [S, P, A]),
      entry('/admin/grades', 'admin.items.grades', BarChart3, [S, P, A]),
      entry('/admin/evidence', 'admin.items.evidence', FolderOpen, [S, A, Q]),
    ],
  },
  {
    id: 'quality',
    titleKey: 'admin.groups.quality',
    items: [
      entry('/admin/qa', 'admin.items.qa', HeartPulse, [S, Q]),
      entry('/admin/qa-reviews', 'admin.items.qaReviews', ShieldCheck, [S, Q]),
      entry('/admin/corrective-actions', 'admin.items.correctiveActions', ClipboardList, [S, Q]),
      entry('/admin/at-risk-students', 'admin.items.atRiskStudents', AlertTriangle, [S, Q]),
      entry('/admin/risk-cases', 'admin.items.riskCases', AlertTriangle, [S, Q]),
      entry('/admin/integrity-cases', 'admin.items.integrity', BadgeAlert, [S, Q]),
    ],
  },
  {
    id: 'accreditation',
    titleKey: 'admin.groups.accreditation',
    items: [
      entry('/admin/recognition-requests', 'admin.items.recognition', FileBadge, [S, P, A]),
      entry('/admin/certificates', 'admin.items.certificates', Award, [S, P]),
      entry('/admin/reports', 'admin.items.reports', FileSpreadsheet, [S, P, A, Q]),
      entry('/admin/audit-logs', 'admin.items.auditLogs', ScrollText, [S]),
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
