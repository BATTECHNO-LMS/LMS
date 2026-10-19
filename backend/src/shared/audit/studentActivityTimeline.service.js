'use strict';

/**
 * Canonical student activity timeline (Logs tab, admin user details, student reports).
 *
 * Includes every audit event where the student is the subject (actions done TO the student,
 * e.g. a grade or attendance change by staff) plus the student's own actions, in
 * chronological order, rendered as human-readable Arabic. Never returns IP addresses,
 * user agents, JWTs, session/request ids, raw JSON or bare UUIDs.
 */

const { prisma } = require('../../config/db');
const {
  getAuditActionMeta,
  categoryLabel,
  outcomeLabel,
} = require('./auditActions');

/** Technical / noisy events never shown in a student's activity history. */
const EXCLUDED_ACTIONS = new Set([
  'AUTH_SESSION_CREATED',
  'AUTH_SESSION_ACTIVITY_STARTED',
  'report.read',
  'REPORT_OPENED',
]);

/** Security-sensitive events only shown when explicitly requested (staff investigations). */
const SECURITY_ONLY_ACTIONS = new Set([
  'USER_LOGIN_FAILED',
  'LOGIN_ACCOUNT_DENIED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'PERMISSION_DENIED',
  'AUTHORIZATION_DENIED',
  'CROSS_SCOPE_ACCESS_DENIED',
  'RATE_LIMIT_TRIGGERED',
  'LOGIN_BRUTE_FORCE_SUSPECTED',
  'OTP_FAILED',
  'OTP_LOCKED_TEMPORARILY',
  'OTP_RATE_LIMITED',
  'AUTH_OTHER_SESSIONS_ENDED',
  'MFA_ENROLLMENT_STARTED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_CHALLENGE_CREATED',
  'MFA_CHALLENGE_SUCCESS',
  'MFA_CHALLENGE_FAILED',
  'MFA_RATE_LIMIT_TRIGGERED',
  'MFA_RECOVERY_CODE_USED',
  'MFA_RECOVERY_CODES_REGENERATED',
  'MFA_RESET_BY_ADMIN',
  'MFA_ADMIN_RESET_DENIED',
  'MFA_STEP_UP_SUCCESS',
  'MFA_STEP_UP_FAILED',
]);

const SESSION_REVOKE_REASON_AR = Object.freeze({
  ADMIN_REVOKED: 'أنهت الإدارة الجلسة',
  PASSWORD_RESET: 'أُنهيت الجلسة بعد إعادة تعيين كلمة المرور',
  PASSWORD_CHANGED: 'أُنهيت الجلسة بعد تغيير كلمة المرور',
  SECURITY_REVOKED: 'أُنهيت الجلسة بسبب تغيير في صلاحيات الحساب أو حالته',
  ROLE_CHANGED: 'أُنهيت الجلسة بسبب تغيير الدور',
  SCOPE_CHANGED: 'أُنهيت الجلسة بسبب تغيير نطاق الحساب',
  MFA_RESET: 'أُنهيت الجلسة بعد إعادة تعيين المصادقة الثنائية',
  USER_REVOKED: 'أنهى المستخدم الجلسة من صفحة الأمان',
  USER_REVOKED_OTHER_SESSIONS: 'أنهى المستخدم الجلسات الأخرى',
});

const ROLE_LABEL_AR = Object.freeze({
  super_admin: 'مدير النظام',
  admin: 'مسؤول',
  reviewer: 'مراجع أكاديمي',
  instructor: 'مشرف / مدرّب',
  trainer: 'مدرّب',
  student: 'طالب',
  trainee: 'متدرب',
});

const STATUS_LABEL_AR = Object.freeze({
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'بعذر',
  unconfirmed: 'غير مؤكد',
  approved: 'مقبول',
  rejected: 'مرفوض',
  pending: 'قيد المراجعة',
  submitted: 'مُسلَّم',
  under_review: 'قيد المراجعة',
  graded: 'مُقيَّم',
  needs_revision: 'بحاجة لتعديل',
  active: 'فعّال',
  inactive: 'غير مفعّل',
  suspended: 'موقوف',
  completed: 'مكتمل',
  issued: 'صادر',
  revoked: 'ملغى',
  eligible: 'مؤهل',
  not_eligible: 'غير مؤهل',
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ANY_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const TITLE_KEYS = ['taskTitle', 'task_title', 'sessionTitle', 'session_title', 'lectureTitle', 'opportunityTitle', 'title'];
const SCORE_PAIRS = [
  ['originalScore', 'newScore'],
  ['old_score', 'new_score'],
  ['previousScore', 'score'],
];

function clean(value, max = 120) {
  if (value == null) return '';
  if (typeof value === 'object') return '';
  const s = String(value).replace(UUID_ANY_RE, '').trim();
  if (!s || s === 'null' || s === 'undefined' || UUID_RE.test(s)) return '';
  return s.slice(0, max);
}

function statusLabel(value) {
  const key = clean(value, 40).toLowerCase();
  return STATUS_LABEL_AR[key] || clean(value, 40);
}

function pick(values, keys) {
  if (!values || typeof values !== 'object') return '';
  for (const key of keys) {
    const v = clean(values[key]);
    if (v) return v;
  }
  return '';
}

/**
 * Human-readable Arabic details from old/new values. Only whitelisted, non-identifying
 * fields are surfaced (titles, statuses, scores, hours, reasons).
 */
function summarizeDetails(row) {
  const nv = row.new_values && typeof row.new_values === 'object' ? row.new_values : {};
  const ov = row.old_values && typeof row.old_values === 'object' ? row.old_values : {};
  const parts = [];

  const title = pick(nv, TITLE_KEYS) || pick(ov, TITLE_KEYS);
  if (title) parts.push(title);

  for (const [oldKey, newKey] of SCORE_PAIRS) {
    const before = clean(nv[oldKey] ?? ov[oldKey], 20);
    const after = clean(nv[newKey], 20);
    if (after) {
      parts.push(before && before !== after ? `الدرجة: ${before} ← ${after}` : `الدرجة: ${after}`);
      break;
    }
  }
  if (!parts.some((p) => p.startsWith('الدرجة')) && clean(nv.score, 20)) {
    parts.push(`الدرجة: ${clean(nv.score, 20)}${clean(nv.maxScore, 20) ? ` / ${clean(nv.maxScore, 20)}` : ''}`);
  }

  const oldStatus = clean(ov.status, 40);
  const newStatus = clean(nv.status ?? nv.review_status, 40);
  if (newStatus) {
    parts.push(
      oldStatus && oldStatus !== newStatus
        ? `الحالة: ${statusLabel(oldStatus)} ← ${statusLabel(newStatus)}`
        : `الحالة: ${statusLabel(newStatus)}`
    );
  }

  const hours = clean(nv.completed_training_hours ?? nv.completedHours, 20);
  if (hours) parts.push(`الساعات: ${hours}`);

  if (row.action_type === 'AUTH_SESSION_IDLE_TIMEOUT') {
    const minutes = clean(nv.idleMinutes, 5) || '30';
    parts.push(`انتهت الجلسة تلقائيًا بعد ${minutes} دقيقة من عدم النشاط`);
  }
  if (row.action_type === 'AUTH_SESSION_ABSOLUTE_EXPIRED') {
    parts.push('انتهت المدة القصوى للجلسة');
  }
  if (row.action_type === 'AUTH_SESSION_ENDED' || row.action_type === 'AUTH_SESSION_REVOKED') {
    const text = SESSION_REVOKE_REASON_AR[clean(nv.endReason, 40)];
    if (text) parts.push(text);
  }
  if (row.action_type === 'USER_LOGIN_FAILED' || row.action_type === 'LOGIN_ACCOUNT_DENIED') {
    const reason = clean(nv.reason, 40);
    if (reason === 'INVALID_PASSWORD') parts.push('كلمة مرور غير صحيحة');
    else if (reason === 'UNKNOWN_IDENTIFIER' || reason === 'ACCOUNT_NOT_FOUND_OR_INVALID') parts.push('حساب غير معروف');
    else if (reason) parts.push('الحساب غير متاح للدخول حاليًا');
  }
  if (row.action_type === 'ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE') {
    const lecture = clean(nv.lectureTitle, 120);
    const session = clean(nv.sessionTitle, 120);
    if (lecture) parts.push(`المحاضرة: ${lecture}`);
    if (session) parts.push(`الجلسة: ${session}`);
    if (!parts.some((p) => p.startsWith('الحالة'))) {
      const before = statusLabel(nv.oldStatus || ov.status);
      const after = statusLabel(nv.status || 'present');
      if (before && after) parts.push(`${before} → ${after}`);
      else if (after) parts.push(`الحالة: ${after}`);
    }
    if (nv.reconciliation === true) {
      parts.push('تم تحديث الحضور بناءً على إكمال المحاضرة المسجلة');
    }
  }

  const reasonText = clean(nv.reason ?? nv.note ?? nv.manual_reason, 160);
  if (reasonText && !/^[A-Z_]+$/.test(reasonText)) parts.push(`السبب: ${reasonText}`);

  return parts.join(' · ');
}

/**
 * Scope restriction for viewers that are not global: rows tagged with another tenant are
 * excluded; rows with no tenant tag (e.g. global actions on the student) stay visible.
 * A missing scope is never treated as global.
 */
function tenantWhere(organizationScope) {
  if (!organizationScope) return { id: { in: [] } };
  if (organizationScope.type === 'global') return null;
  const uni = organizationScope.universityId || null;
  const org = organizationScope.organizationId || null;
  if (!uni && !org) return { id: { in: [] } };
  const or = [{ university_id: null, organization_id: null }];
  if (uni) or.push({ university_id: uni });
  if (org) or.push({ organization_id: org });
  return { OR: or };
}

async function opportunityEntityIds(studentId, opportunityId) {
  const [apps, tasks, sessions, lectures, assessments] = await Promise.all([
    prisma.field_training_applications.findMany({
      where: { student_id: studentId, opportunity_id: opportunityId },
      select: { id: true },
    }),
    prisma.field_training_tasks.findMany({ where: { opportunity_id: opportunityId }, select: { id: true } }),
    prisma.field_training_sessions.findMany({ where: { opportunity_id: opportunityId }, select: { id: true } }),
    prisma.field_training_recorded_lectures.findMany({ where: { opportunity_id: opportunityId }, select: { id: true } }),
    prisma.field_training_assessments.findMany({ where: { opportunity_id: opportunityId }, select: { id: true } }),
  ]);
  const appIds = apps.map((r) => r.id);
  const [submissions, attendance, letters, ratings, finals, attempts] = await Promise.all([
    prisma.field_training_task_submissions.findMany({
      where: { student_id: studentId, task_id: { in: tasks.map((t) => t.id) } },
      select: { id: true },
    }),
    prisma.field_training_attendance.findMany({
      where: { student_id: studentId, session_id: { in: sessions.map((s) => s.id) } },
      select: { id: true },
    }),
    appIds.length
      ? prisma.field_training_completion_letters.findMany({ where: { application_id: { in: appIds } }, select: { id: true } })
      : [],
    prisma.field_training_supervisor_ratings.findMany({
      where: { student_id: studentId, opportunity_id: opportunityId },
      select: { id: true },
    }),
    prisma.field_training_final_evaluations.findMany({
      where: { student_id: studentId, opportunity_id: opportunityId },
      select: { id: true },
    }),
    prisma.field_training_assessment_attempts.findMany({
      where: { student_id: studentId, assessment_id: { in: assessments.map((a) => a.id) } },
      select: { id: true },
    }),
  ]);
  const own = [
    ...appIds,
    ...submissions.map((r) => r.id),
    ...attendance.map((r) => r.id),
    ...letters.map((r) => r.id),
    ...ratings.map((r) => r.id),
    ...finals.map((r) => r.id),
    ...attempts.map((r) => r.id),
  ];
  const shared = [
    opportunityId,
    ...tasks.map((r) => r.id),
    ...sessions.map((r) => r.id),
    ...lectures.map((r) => r.id),
    ...assessments.map((r) => r.id),
  ];
  return { own, all: [...shared, ...own] };
}

async function courseEntityIds(studentId, courseId) {
  const [cohorts, tasks, materials, assessments] = await Promise.all([
    prisma.training_cohorts.findMany({ where: { program_id: courseId }, select: { id: true } }),
    prisma.training_tasks.findMany({ where: { program_id: courseId }, select: { id: true } }),
    prisma.training_materials.findMany({ where: { program_id: courseId }, select: { id: true } }),
    prisma.training_assessments.findMany({ where: { program_id: courseId }, select: { id: true } }),
  ]);
  const cohortIds = cohorts.map((c) => c.id);
  const [enrollments, sessions, submissions, attempts] = await Promise.all([
    prisma.training_enrollments.findMany({
      where: { user_id: studentId, cohort_id: { in: cohortIds } },
      select: { id: true },
    }),
    prisma.training_sessions.findMany({ where: { cohort_id: { in: cohortIds } }, select: { id: true } }),
    prisma.training_task_submissions.findMany({
      where: { user_id: studentId, task_id: { in: tasks.map((t) => t.id) } },
      select: { id: true },
    }),
    prisma.training_assessment_attempts.findMany({
      where: { user_id: studentId, assessment_id: { in: assessments.map((a) => a.id) } },
      select: { id: true },
    }),
  ]);
  const attendance = await prisma.training_attendance_records.findMany({
    where: { user_id: studentId, session_id: { in: sessions.map((s) => s.id) } },
    select: { id: true },
  });
  const own = [
    ...enrollments.map((r) => r.id),
    ...submissions.map((r) => r.id),
    ...attempts.map((r) => r.id),
    ...attendance.map((r) => r.id),
  ];
  const shared = [
    courseId,
    ...cohortIds,
    ...tasks.map((r) => r.id),
    ...materials.map((r) => r.id),
    ...assessments.map((r) => r.id),
    ...sessions.map((r) => r.id),
  ];
  return { own, all: [...shared, ...own] };
}

function jsonKeyMatches(keys, value) {
  return keys.map((key) => ({ new_values: { path: [key], equals: value } }));
}

/**
 * Build the Prisma `where` for a student's timeline.
 */
async function buildTimelineWhere({
  studentId,
  organizationScope,
  dateRange,
  opportunityId,
  courseId,
  includeSecurityEvents = false,
}) {
  const oppIds = opportunityId ? await opportunityEntityIds(studentId, opportunityId) : null;
  const courseIds = courseId ? await courseEntityIds(studentId, courseId) : null;
  // Entities owned by the student also attach legacy rows written before subject_user_id existed.
  const ownIds = [...(oppIds?.own || []), ...(courseIds?.own || [])];
  const involving = [{ subject_user_id: studentId }, { user_id: studentId }];
  if (ownIds.length) involving.push({ subject_user_id: null, entity_id: { in: ownIds } });
  const and = [{ OR: involving }];
  const excluded = [...EXCLUDED_ACTIONS, ...(includeSecurityEvents ? [] : SECURITY_ONLY_ACTIONS)];
  and.push({ action_type: { notIn: excluded } });
  if (!includeSecurityEvents) and.push({ OR: [{ category: null }, { category: { not: 'SECURITY' } }] });

  const tenant = tenantWhere(organizationScope);
  if (tenant) and.push(tenant);

  if (dateRange?.from || dateRange?.to) {
    const range = {};
    if (dateRange.from) range.gte = new Date(dateRange.from);
    if (dateRange.to) range.lte = new Date(dateRange.to);
    and.push({ created_at: range });
  }

  if (opportunityId) {
    const ids = oppIds.all;
    const opp = await prisma.field_training_opportunities.findUnique({
      where: { id: opportunityId },
      select: { start_date: true, end_date: true },
    });
    const scoped = [
      { entity_id: { in: ids } },
      ...jsonKeyMatches(['opportunityId', 'opportunity_id'], opportunityId),
    ];
    // Platform sign-in/out during the training window is part of the student's engagement.
    if (opp?.start_date) {
      const end = opp.end_date ? new Date(new Date(opp.end_date).getTime() + 86_400_000) : undefined;
      scoped.push({
        category: 'AUTH',
        created_at: { gte: new Date(opp.start_date), ...(end ? { lte: end } : {}) },
      });
    }
    and.push({ OR: scoped });
  }

  if (courseId) {
    const ids = courseIds.all;
    and.push({
      OR: [
        { entity_id: { in: ids } },
        ...jsonKeyMatches(['programId', 'program_id', 'courseId', 'course_id'], courseId),
      ],
    });
  }

  return { AND: and };
}

function actorDescription(row, actor, studentId) {
  if (!row.user_id) return { name: 'النظام', role: null, is_self: false };
  if (row.user_id === studentId) return { name: 'الطالب', role: ROLE_LABEL_AR.student, is_self: true };
  const roleCode = row.actor_role || null;
  return {
    name: actor?.full_name || 'مستخدم',
    role: roleCode ? ROLE_LABEL_AR[roleCode] || null : null,
    is_self: false,
  };
}

const ACTIVITY_TIME_ZONE = process.env.REPORT_TIME_ZONE || 'Asia/Amman';

function formatActivityDateTimeAr(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: ACTIVITY_TIME_ZONE,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function presentRow(row, actor, studentId) {
  const meta = getAuditActionMeta(row.action_type);
  const category = row.category || meta?.category || 'SYSTEM';
  const outcome = row.outcome || 'SUCCESS';
  return {
    id: row.id,
    at: row.created_at,
    at_label: formatActivityDateTimeAr(row.created_at),
    action: row.action_type,
    action_label: meta?.labelAr || 'نشاط على المنصة',
    category,
    category_label: categoryLabel(category) || categoryLabel('SYSTEM'),
    outcome,
    outcome_label: outcomeLabel(outcome) || outcomeLabel('SUCCESS'),
    actor: actorDescription(row, actor, studentId),
    details: summarizeDetails(row),
  };
}

/**
 * @param {{
 *   studentId: string,
 *   organizationScope: { type: 'global'|'university'|'organization', universityId?: string|null, organizationId?: string|null } | null,
 *   dateRange?: { from?: Date|string, to?: Date|string },
 *   opportunityId?: string,
 *   courseId?: string,
 *   includeSecurityEvents?: boolean,
 *   order?: 'asc'|'desc',
 *   skip?: number,
 *   take?: number,      omit for the full history (reports)
 * }} params
 * @returns {Promise<{ events: object[], total: number }>}
 */
async function getStudentActivityTimeline(params) {
  if (!params?.studentId || !UUID_RE.test(params.studentId)) return { events: [], total: 0 };
  const where = await buildTimelineWhere(params);
  const order = params.order === 'desc' ? 'desc' : 'asc';
  const hardCap = 5_000;
  const take = params.take != null ? Math.min(params.take, hardCap) : hardCap;
  const [total, rows] = await Promise.all([
    prisma.audit_logs.count({ where }),
    prisma.audit_logs.findMany({
      where,
      orderBy: [{ created_at: order }, { id: order }],
      skip: params.skip || 0,
      take,
      select: {
        id: true,
        user_id: true,
        subject_user_id: true,
        action_type: true,
        entity_type: true,
        category: true,
        outcome: true,
        actor_role: true,
        old_values: true,
        new_values: true,
        created_at: true,
      },
    }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.user_id).filter((id) => id && id !== params.studentId))];
  const actors = actorIds.length
    ? await prisma.users.findMany({ where: { id: { in: actorIds } }, select: { id: true, full_name: true } })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  return {
    events: rows.map((row) => presentRow(row, actorMap.get(row.user_id), params.studentId)),
    total,
  };
}

module.exports = {
  getStudentActivityTimeline,
  buildTimelineWhere,
  summarizeDetails,
  presentRow,
  formatActivityDateTimeAr,
  tenantWhere,
  EXCLUDED_ACTIONS,
  SECURITY_ONLY_ACTIONS,
};
