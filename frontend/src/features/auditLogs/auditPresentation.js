/**
 * Pure presentation helpers for the activity log (no React; unit-tested with node --test).
 */

export const AUDIT_PAGE_SIZES = Object.freeze([25, 50]);
export const AUDIT_AUTO_REFRESH_MS = 30_000;

export const ROLE_LABELS_AR = Object.freeze({
  super_admin: 'مدير النظام',
  admin: 'مسؤول',
  instructor: 'مشرف / مدرّب',
  trainer: 'مدرّب',
  reviewer: 'مراجع أكاديمي',
  student: 'طالب',
  trainee: 'متدرب',
});

export const OUTCOME_VARIANTS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'danger',
  DENIED: 'warning',
  BLOCKED: 'danger',
});

export const SEVERITY_VARIANTS = Object.freeze({
  INFO: 'neutral',
  WARNING: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
});

export const SESSION_END_REASON_LABELS_AR = Object.freeze({
  USER_LOGOUT: 'إنهاء الجلسة من المستخدم',
  ADMIN_REVOKED: 'إنهاء من الإدارة',
  IDLE_TIMEOUT: 'انتهت لعدم النشاط',
  ABSOLUTE_EXPIRY: 'انتهت المدة القصوى',
  PASSWORD_RESET: 'إنهاء بعد إعادة تعيين كلمة المرور',
  PASSWORD_CHANGED: 'إنهاء بعد تغيير كلمة المرور',
  SECURITY_REVOKED: 'إنهاء أمني',
  ROLE_CHANGED: 'إنهاء بسبب تغيير الدور',
  SCOPE_CHANGED: 'إنهاء بسبب تغيير نطاق الحساب',
  MFA_RESET: 'إنهاء بعد إعادة تعيين المصادقة الثنائية',
  USER_REVOKED: 'أنهاها المستخدم من صفحة الأمان',
  USER_REVOKED_OTHER_SESSIONS: 'إنهاء الجلسات الأخرى من المستخدم',
});

/** Keys whose values are shown in the human-readable details list (others stay super-admin raw JSON). */
const DETAIL_KEY_LABELS_AR = Object.freeze({
  title: 'العنوان',
  taskTitle: 'المهمة',
  task_title: 'المهمة',
  sessionTitle: 'الجلسة',
  opportunityTitle: 'فرصة التدريب',
  status: 'الحالة',
  review_status: 'حالة المراجعة',
  score: 'الدرجة',
  newScore: 'الدرجة الجديدة',
  originalScore: 'الدرجة السابقة',
  maxScore: 'الدرجة القصوى',
  reason: 'السبب',
  note: 'ملاحظة',
  role_codes: 'الأدوار',
  roles: 'الأدوار',
  name: 'الاسم',
  fileName: 'اسم الملف',
  file_name: 'اسم الملف',
  sizeBytes: 'الحجم (بايت)',
  affected_count: 'عدد المتأثرين',
  count: 'العدد',
  idleMinutes: 'دقائق عدم النشاط',
  lastActivityAt: 'آخر نشاط',
  endedAt: 'وقت الانتهاء',
  endReason: 'سبب الانتهاء',
  portalType: 'البوابة',
  identifierMasked: 'المعرّف (مقنّع)',
  limiter: 'آلية التقييد',
  routeGroup: 'مجموعة المسارات',
  route: 'المسار',
  method: 'نوع الطلب',
  purpose: 'الغرض',
  attemptsUsed: 'المحاولات المستخدمة',
  maxAttempts: 'الحد الأقصى للمحاولات',
  retryAfterSeconds: 'الانتظار (ثوانٍ)',
  scopeType: 'نطاق الرفض',
  module: 'القسم',
  completed_training_hours: 'الساعات المكتملة',
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function roleLabel(code) {
  if (!code) return '';
  return ROLE_LABELS_AR[String(code)] || '';
}

export function outcomeVariant(outcome) {
  return OUTCOME_VARIANTS[String(outcome || 'SUCCESS')] || 'default';
}

export function severityVariant(severity) {
  return SEVERITY_VARIANTS[String(severity || '')] || 'default';
}

export function formatAuditDateTime(value, locale = 'ar-JO') {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function personLabel(person) {
  if (!person) return '';
  return person.full_name || person.email || '';
}

/** "Who" column: actor name (+ role), or "النظام" for system rows. */
export function actorLabel(row) {
  const name = personLabel(row?.user);
  if (!name) return row?.user_id ? 'مستخدم' : 'النظام';
  const role = roleLabel(row?.actor_role);
  return role ? `${name} · ${role}` : name;
}

/** Subject shown only when it differs from the actor. */
export function subjectLabel(row) {
  if (!row?.subject_user_id || row.subject_user_id === row.user_id) return '';
  return personLabel(row.subject) || 'مستخدم';
}

export function actionLabel(row, { showRaw = false } = {}) {
  const label = row?.action_label || '';
  if (label) return label;
  return showRaw ? String(row?.action_type || '') : 'نشاط على المنصة';
}

function displayScalar(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(displayScalar).filter(Boolean);
    return items.length ? items.slice(0, 10).join('، ') + (items.length > 10 ? ` (+${items.length - 10})` : '') : null;
  }
  if (typeof value === 'object') return null;
  const s = String(value);
  if (UUID_RE.test(s)) return null;
  if (ISO_RE.test(s)) return formatAuditDateTime(s);
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

/**
 * Human-readable change list from old/new values (whitelisted keys only; no ids).
 * @returns {{ key: string, label: string, before: string|null, after: string|null }[]}
 */
export function describeValueChanges(oldValues, newValues) {
  const before = oldValues && typeof oldValues === 'object' && !Array.isArray(oldValues) ? oldValues : {};
  const after = newValues && typeof newValues === 'object' && !Array.isArray(newValues) ? newValues : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => DETAIL_KEY_LABELS_AR[k]
  );
  return keys
    .map((key) => {
      const show = key === 'endReason' ? (v) => SESSION_END_REASON_LABELS_AR[v] || displayScalar(v) : displayScalar;
      return { key, label: DETAIL_KEY_LABELS_AR[key], before: show(before[key]), after: show(after[key]) };
    })
    .filter((row) => row.before != null || row.after != null);
}

/**
 * Map UI filter state to backend query params (empty values dropped).
 */
export function buildAuditQueryParams(filters = {}, { page = 1, pageSize = 25 } = {}) {
  const params = { page, page_size: AUDIT_PAGE_SIZES.includes(Number(pageSize)) ? Number(pageSize) : 25 };
  const map = {
    from: 'from',
    to: 'to',
    search: 'search',
    category: 'category',
    outcome: 'outcome',
    actionType: 'action_type',
    actorRole: 'actor_role',
    universityId: 'university_id',
    organizationId: 'organization_id',
    entityType: 'entity_type',
    entityId: 'entity_id',
    sessionId: 'session_id',
    userId: 'user_id',
    subjectUserId: 'subject_user_id',
    involvingUserId: 'involving_user_id',
    securityCategory: 'security_category',
    severity: 'severity',
    securityOnly: 'security_only',
    ipAddress: 'ip_address',
    requestId: 'request_id',
  };
  for (const [key, param] of Object.entries(map)) {
    const value = filters[key];
    if (value == null) continue;
    const s = String(value).trim();
    if (!s) continue;
    if (['entityId', 'sessionId', 'userId', 'subjectUserId', 'involvingUserId', 'universityId', 'organizationId'].includes(key) && !UUID_RE.test(s)) {
      continue;
    }
    params[param] = s;
  }
  return params;
}

export function countActiveFilters(filters = {}) {
  return Object.values(filters).filter((v) => v != null && String(v).trim() !== '').length;
}

export function sessionStatusLabel(session) {
  if (!session) return '';
  if (session.is_active) return 'نشطة';
  return SESSION_END_REASON_LABELS_AR[session.end_reason] || 'منتهية';
}
