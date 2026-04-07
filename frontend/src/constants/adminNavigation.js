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
} from 'lucide-react';
import { ROLES } from './roles.js';

const S = ROLES.SUPER_ADMIN;
const P = ROLES.PROGRAM_ADMIN;
const A = ROLES.ACADEMIC_ADMIN;
const Q = ROLES.QA_OFFICER;

/** All admin-shell roles */
export const ADMIN_SHELL_ROLES = [S, P, A, Q];

function entry(to, label, icon, roles) {
  return { to, label, icon, roles };
}

/**
 * Grouped navigation — items filtered by role in `getAdminNavGroupsForRole`.
 */
export const ADMIN_NAV_GROUPS = [
  {
    id: 'general',
    title: 'الإدارة العامة',
    items: [
      entry('/admin/dashboard', 'الرئيسية', LayoutDashboard, [S, P, A, Q]),
      entry('/admin/users', 'المستخدمون', Users, [S]),
      entry('/admin/roles-permissions', 'الأدوار والصلاحيات', Shield, [S]),
      entry('/admin/settings', 'الإعدادات', Settings, [S]),
    ],
  },
  {
    id: 'orgs',
    title: 'المؤسسات والبرامج',
    items: [
      entry('/admin/universities', 'الجامعات', Building2, [S, P]),
      entry('/admin/tracks', 'المسارات', Route, [S, P, A]),
      entry('/admin/micro-credentials', 'الشهادات المصغرة', GraduationCap, [S, A]),
      entry('/admin/learning-outcomes', 'مخرجات التعلم', ListTree, [S, A]),
      entry('/admin/cohorts', 'الدفعات', Layers, [S, P, A]),
      entry('/admin/content', 'المحتوى', BookOpen, [S, P, A]),
    ],
  },
  {
    id: 'delivery',
    title: 'التنفيذ والتعليم',
    items: [
      entry('/admin/sessions', 'الجلسات', CalendarDays, [S, P, A, Q]),
      entry('/admin/attendance', 'الحضور', ClipboardCheck, [S, P, A, Q]),
      entry('/admin/assessments', 'التقييمات', FileCheck, [S, A, Q]),
      entry('/admin/rubrics', 'معايير التقييم', ListChecks, [S, A]),
      entry('/admin/submissions', 'التسليمات', Upload, [S, P, A]),
      entry('/admin/grades', 'الدرجات', BarChart3, [S, P, A]),
      entry('/admin/evidence', 'الأدلة', FolderOpen, [S, A, Q]),
    ],
  },
  {
    id: 'quality',
    title: 'الجودة والمتابعة',
    items: [
      entry('/admin/qa', 'الجودة', HeartPulse, [S, Q]),
      entry('/admin/qa-reviews', 'مراجعات الجودة', ShieldCheck, [S, Q]),
      entry('/admin/corrective-actions', 'الإجراءات التصحيحية', ClipboardList, [S, Q]),
      entry('/admin/at-risk-students', 'الطلبة المتعثرون', AlertTriangle, [S, Q]),
      entry('/admin/risk-cases', 'حالات المخاطر', AlertTriangle, [S, Q]),
      entry('/admin/integrity-cases', 'النزاهة الأكاديمية', BadgeAlert, [S, Q]),
    ],
  },
  {
    id: 'accreditation',
    title: 'الاعتماد والتقارير',
    items: [
      entry('/admin/recognition-requests', 'طلبات الاعتراف الأكاديمي', FileBadge, [S, P, A]),
      entry('/admin/certificates', 'الشهادات الرقمية', Award, [S, P]),
      entry('/admin/reports', 'التقارير', FileSpreadsheet, [S, P, A, Q]),
      entry('/admin/audit-logs', 'سجل التدقيق', ScrollText, [S]),
    ],
  },
];

export function getAdminNavGroupsForRole(role) {
  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function flattenAdminNavItems(role) {
  return getAdminNavGroupsForRole(role).flatMap((g) => g.items);
}
