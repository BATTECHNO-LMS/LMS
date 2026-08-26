import { ROLES } from '../../../constants/roles.js';
import { contentStatusVariant, formatDate, statusLabel } from './contentHub.shared.js';

export const NOTIFICATION_RULE_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
export const NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const NOTIFICATION_CATEGORIES = [
  'ACCOUNT',
  'OPPORTUNITY',
  'APPLICATION',
  'SESSION',
  'ATTENDANCE',
  'TASK',
  'TEST',
  'PROGRESS',
  'CERTIFICATE',
  'REPORT',
  'SUPPORT',
  'ANNOUNCEMENT',
  'SYSTEM',
];
export const NOTIFICATION_CHANNELS = [
  'IN_APP',
  'NOTIFICATION_CENTER',
  'BELL',
  'POPUP',
  'TOP_BANNER',
  'EMAIL',
  'PUSH',
];
export const PREFERENCE_CHANNELS = ['EMAIL', 'PUSH'];
export const AGGREGATION_MODES = ['NONE', 'PER_ENTITY', 'HOURLY_DIGEST', 'DAILY_DIGEST', 'WEEKLY_DIGEST'];
export const DELIVERY_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
];

export const NOTIFICATION_ROLE_OPTIONS = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.INSTRUCTOR,
  ROLES.TRAINER,
  ROLES.TRAINEE,
  ROLES.STUDENT,
  ROLES.REVIEWER,
];

export const CATEGORY_LABELS = {
  ar: {
    ACCOUNT: 'الحساب',
    OPPORTUNITY: 'الفرص',
    APPLICATION: 'الطلبات',
    SESSION: 'الجلسات',
    ATTENDANCE: 'الحضور',
    TASK: 'المهام',
    TEST: 'الاختبارات',
    PROGRESS: 'التقدم',
    CERTIFICATE: 'الشهادات',
    REPORT: 'التقارير',
    SUPPORT: 'الدعم',
    ANNOUNCEMENT: 'الإعلانات',
    SYSTEM: 'النظام',
  },
  en: {
    ACCOUNT: 'Account',
    OPPORTUNITY: 'Opportunity',
    APPLICATION: 'Application',
    SESSION: 'Session',
    ATTENDANCE: 'Attendance',
    TASK: 'Task',
    TEST: 'Test',
    PROGRESS: 'Progress',
    CERTIFICATE: 'Certificate',
    REPORT: 'Report',
    SUPPORT: 'Support',
    ANNOUNCEMENT: 'Announcement',
    SYSTEM: 'System',
  },
};

export const PRIORITY_LABELS = {
  ar: { LOW: 'منخفضة', NORMAL: 'عادية', HIGH: 'عالية', URGENT: 'عاجلة' },
  en: { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' },
};

export const CHANNEL_LABELS = {
  ar: {
    IN_APP: 'داخل التطبيق',
    NOTIFICATION_CENTER: 'مركز الإشعارات',
    BELL: 'الجرس',
    POPUP: 'نافذة منبثقة',
    TOP_BANNER: 'شريط علوي',
    EMAIL: 'بريد إلكتروني',
    PUSH: 'إشعار فوري',
  },
  en: {
    IN_APP: 'In-app',
    NOTIFICATION_CENTER: 'Notification center',
    BELL: 'Bell',
    POPUP: 'Popup',
    TOP_BANNER: 'Top banner',
    EMAIL: 'Email',
    PUSH: 'Push',
  },
};

/** Categories treated as critical for preference UI (cannot fully opt out). */
export const CRITICAL_PREFERENCE_CATEGORIES = ['ACCOUNT', 'SYSTEM'];

export function categoryLabel(category, isArabic) {
  const key = String(category || '').toUpperCase();
  return (isArabic ? CATEGORY_LABELS.ar : CATEGORY_LABELS.en)[key] || category || '—';
}

export function priorityLabel(priority, isArabic) {
  const key = String(priority || '').toUpperCase();
  return (isArabic ? PRIORITY_LABELS.ar : PRIORITY_LABELS.en)[key] || priority || '—';
}

export function channelLabel(channel, isArabic) {
  const key = String(channel || '').toUpperCase();
  return (isArabic ? CHANNEL_LABELS.ar : CHANNEL_LABELS.en)[key] || channel || '—';
}

export function ruleStatusVariant(status) {
  const v = String(status || '').toUpperCase();
  if (v === 'ACTIVE') return 'success';
  if (v === 'ARCHIVED') return 'danger';
  if (v === 'PAUSED') return 'warning';
  if (v === 'DRAFT') return 'muted';
  return contentStatusVariant(status);
}

export function priorityVariant(priority) {
  const v = String(priority || '').toUpperCase();
  if (v === 'URGENT') return 'danger';
  if (v === 'HIGH') return 'warning';
  if (v === 'LOW') return 'muted';
  return 'info';
}

export function deliveryStatusVariant(status) {
  const v = String(status || '').toUpperCase();
  if (v === 'FAILED') return 'danger';
  if (v === 'SENT' || v === 'DELIVERED' || v === 'READ') return 'success';
  if (v === 'PENDING' || v === 'PROCESSING') return 'warning';
  if (v === 'CANCELLED' || v === 'SKIPPED') return 'muted';
  return 'info';
}

export { formatDate, statusLabel };
