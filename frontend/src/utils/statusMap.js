export function genericStatusVariant(s) {
  const v = String(s || '').toLowerCase();
  if (['active', 'approved', 'published', 'completed', 'running'].includes(v)) return 'success';
  if (['inactive', 'rejected', 'cancelled', 'archived', 'suspended'].includes(v)) return 'danger';
  if (['pending', 'planned'].includes(v)) return 'warning';
  if (['draft'].includes(v)) return 'muted';
  return 'info';
}

export function statusLabelAr(s) {
  const map = {
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
  return map[s] ?? s;
}
