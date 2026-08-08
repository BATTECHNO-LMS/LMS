import { ROLES } from '../../../constants/roles.js';

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const POPUP_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'];
export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
export const POPUP_TYPES = ['INFO', 'SUCCESS', 'WARNING', 'IMPORTANT', 'URGENT'];
export const DISPLAY_RULES = ['ONCE', 'ONCE_PER_VERSION', 'EVERY_LOGIN', 'UNTIL_ACKNOWLEDGED', 'DATE_RANGE', 'EVENT_TRIGGERED'];
export const ANNOUNCEMENT_TYPES = ['INFORMATION', 'SUCCESS', 'WARNING', 'IMPORTANT', 'URGENT', 'MAINTENANCE'];
export const CHANNEL_CODES = [
  'TOP_BANNER',
  'DASHBOARD_CARD',
  'POPUP',
  'NOTIFICATION_CENTER',
  'IN_APP_NOTIFICATION',
  'CONTEXTUAL_BLOCK',
  'EMAIL',
  'PUSH_NOTIFICATION',
  'SMS',
];

export const ROLE_OPTIONS = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.STUDENT,
  ROLES.REVIEWER,
];

export const ROLE_LABELS = {
  ar: {
    super_admin: 'مشرف أعلى',
    admin: 'مشرف',
    instructor: 'مدرب',
    student: 'طالب',
    reviewer: 'مراجع',
  },
  en: {
    super_admin: 'Super admin',
    admin: 'Admin',
    instructor: 'Instructor',
    student: 'Student',
    reviewer: 'Reviewer',
  },
};

export function statusLabel(status, isArabic) {
  const key = String(status || '').toUpperCase();
  const ar = {
    DRAFT: 'مسودة',
    PUBLISHED: 'منشور',
    ARCHIVED: 'مؤرشف',
    PAUSED: 'موقوف',
    SCHEDULED: 'مجدول',
    EXPIRED: 'منتهي',
    ACTIVE: 'نشط',
  };
  const en = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
    PAUSED: 'Paused',
    SCHEDULED: 'Scheduled',
    EXPIRED: 'Expired',
    ACTIVE: 'Active',
  };
  return (isArabic ? ar : en)[key] || status || '—';
}

export function formatDate(value, locale = 'ar') {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(locale === 'en' ? 'en-GB' : 'ar');
  } catch {
    return String(value);
  }
}

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
}

export function contentStatusVariant(status) {
  const v = String(status || '').toUpperCase();
  if (v === 'PUBLISHED') return 'success';
  if (v === 'ARCHIVED' || v === 'EXPIRED') return 'danger';
  if (v === 'PAUSED' || v === 'SCHEDULED') return 'warning';
  if (v === 'DRAFT') return 'muted';
  return 'info';
}

export const CONTENT_AUDIT_PREFIXES = ['HELP_', 'ANNOUNCEMENT_', 'POPUP_', 'USER_GUIDE_', 'popup_', 'announcement.'];

export function isContentAuditAction(actionType) {
  const a = String(actionType || '');
  return CONTENT_AUDIT_PREFIXES.some((p) => a.startsWith(p));
}
