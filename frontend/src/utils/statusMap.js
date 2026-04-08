import { getCurrentLocale, normalizeLocale } from './locale.js';

export function genericStatusVariant(s) {
  const v = String(s || '').toLowerCase();
  if (['active', 'approved', 'published', 'completed', 'running'].includes(v)) return 'success';
  if (['inactive', 'rejected', 'cancelled', 'archived', 'suspended'].includes(v)) return 'danger';
  if (['pending', 'planned'].includes(v)) return 'warning';
  if (['draft'].includes(v)) return 'muted';
  return 'info';
}

export function statusLabelAr(s, locale = getCurrentLocale()) {
  const mapAr = {
    active: 'نشط',
    inactive: 'غير نشط',
    suspended: 'موقوف',
    draft: 'مسودة',
    approved: 'معتمد',
    pending: 'قيد المراجعة',
    published: 'منشور',
    closed: 'مغلق',
    planned: 'مخطط',
    running: 'قيد التنفيذ',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    rejected: 'مرفوض',
    archived: 'مؤرشف',
  };
  const mapEn = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    draft: 'Draft',
    approved: 'Approved',
    pending: 'Pending review',
    published: 'Published',
    closed: 'Closed',
    planned: 'Planned',
    running: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    archived: 'Archived',
  };
  const map = normalizeLocale(locale) === 'en' ? mapEn : mapAr;
  return map[s] ?? s;
}
