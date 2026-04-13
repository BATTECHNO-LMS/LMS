import { getCurrentLocale, normalizeLocale } from './locale.js';

export function genericStatusVariant(s) {
  const v = String(s || '').toLowerCase();
  if (['active', 'approved', 'published', 'open', 'completed', 'running', 'enrolled', 'documented'].includes(v))
    return 'success';
  if (['inactive', 'rejected', 'cancelled', 'archived', 'suspended'].includes(v)) return 'danger';
  if (['pending', 'planned', 'open_for_enrollment', 'under_review', 'incomplete', 'in_preparation', 'needs_revision'].includes(v))
    return 'warning';
  if (['ready_for_submission', 'submitted'].includes(v)) return 'info';
  if (['issued'].includes(v)) return 'success';
  if (['revoked', 'superseded'].includes(v)) return 'danger';
  if (['draft', 'not_started'].includes(v)) return 'muted';
  if (['in_review'].includes(v)) return 'warning';
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
    open: 'مفتوح',
    in_progress: 'قيد التنفيذ',
    resolved: 'محسوم',
    closed: 'مغلق',
    escalated: 'متصاعد',
    reported: 'مبلّغ',
    under_investigation: 'قيد التحقيق',
    overdue: 'متأخر',
    planned: 'مخطط',
    running: 'قيد التنفيذ',
    open_for_enrollment: 'مفتوح للتسجيل',
    enrolled: 'مسجّل',
    withdrawn: 'منسحب',
    documented: 'موثّق',
    incomplete: 'ناقص',
    late: 'متأخر',
    absent: 'غائب',
    present: 'حاضر',
    excused: 'معذور',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    rejected: 'مرفوض',
    archived: 'مؤرشف',
    under_review: 'قيد المراجعة',
    in_review: 'قيد المراجعة الداخلية',
    not_started: 'لم يبدأ',
    online: 'عن بُعد',
    onsite: 'حضوري',
    hybrid: 'مختلط',
    self_paced: 'ذاتي',
    in_preparation: 'قيد الإعداد',
    ready_for_submission: 'جاهز للتقديم',
    submitted: 'مقدّم',
    needs_revision: 'يحتاج مراجعة',
    issued: 'صادرة',
    revoked: 'ملغاة',
    superseded: 'مستبدلة',
  };
  const mapEn = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    draft: 'Draft',
    approved: 'Approved',
    pending: 'Pending review',
    published: 'Published',
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
    escalated: 'Escalated',
    reported: 'Reported',
    under_investigation: 'Under investigation',
    overdue: 'Overdue',
    planned: 'Planned',
    running: 'In progress',
    open_for_enrollment: 'Open for enrollment',
    enrolled: 'Enrolled',
    withdrawn: 'Withdrawn',
    documented: 'Documented',
    incomplete: 'Incomplete',
    late: 'Late',
    absent: 'Absent',
    present: 'Present',
    excused: 'Excused',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    archived: 'Archived',
    under_review: 'Under review',
    in_review: 'Internal review',
    not_started: 'Not started',
    online: 'Online',
    onsite: 'On-site',
    hybrid: 'Hybrid',
    self_paced: 'Self-paced',
    in_preparation: 'In preparation',
    ready_for_submission: 'Ready for submission',
    submitted: 'Submitted',
    needs_revision: 'Needs revision',
    issued: 'Issued',
    revoked: 'Revoked',
    superseded: 'Superseded',
  };
  const map = normalizeLocale(locale) === 'en' ? mapEn : mapAr;
  return map[s] ?? s;
}
