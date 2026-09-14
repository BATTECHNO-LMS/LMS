'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { LIVE_ACTIVITY_ACTIONS, PRESENCE_WINDOW_SECONDS } = require('./analytics.definitions');
const { intCount } = require('./analytics.percent');
const { scopeAuditSql, nonMeaningfulSql } = require('./commandCenter.sql');
const { translateStudentActivityEvent } = require('../fieldTraining/fieldTraining.activityTranslate');

const ACTION_LABELS_AR = Object.freeze({
  USER_LOGIN_SUCCESS: 'تسجيل الدخول',
  USER_REGISTERED: 'تسجيل حساب جديد',
  INSTITUTION_USER_REGISTERED: 'تسجيل حساب مؤسسة',
  enrollment_approved: 'قبول تسجيل',
  enrollment_requested: 'طلب تسجيل',
  'certificate.issue': 'إصدار شهادة',
  'certificate.status': 'تحديث حالة شهادة',
  FIELD_TRAINING_STARTED: 'بدء التدريب الميداني',
  FIELD_TRAINING_APPLICATION_APPROVED: 'الموافقة على طلب تدريب',
  FIELD_TRAINING_APPLICATION_REJECTED: 'رفض طلب تدريب',
  FIELD_TRAINING_SUBMISSION_REVIEWED: 'تقييم مهمة',
  FIELD_TRAINING_ASSESSMENT_PUBLISHED: 'نشر اختبار',
  FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM: 'تأكيد حضور',
  FIELD_TRAINING_COMPLETION_LETTER_ISSUED: 'إصدار كتاب إتمام',
  FIELD_TRAINING_ELIGIBILITY_RECALCULATED: 'تحديث أهلية التدريب',
  FIELD_TRAINING_PARTICIPANT_EXPELLED: 'فصل متدرب',
  FT_EVAL_REPORT_GENERATED: 'إنشاء تقرير تقييم',
});

function humanizeAction(row) {
  const translated = translateStudentActivityEvent(row);
  const fallback = ACTION_LABELS_AR[row.action_type];
  return {
    title: fallback || translated.title || 'نشاط على المنصة',
    description: translated.description,
    category: translated.category,
  };
}

function entityHref(row) {
  const type = String(row.entity_type || '').toLowerCase();
  const id = row.entity_id;
  if (!id) return null;
  if (type.includes('certificate')) return `/admin/certificates/${id}`;
  if (type.includes('user')) return `/admin/users/${id}`;
  if (type.includes('field_training') || type.includes('opportunity') || type.includes('application')) {
    return `/admin/field-training`;
  }
  if (type.includes('audit')) return `/admin/audit-logs/${id}`;
  return null;
}

async function getLiveActivity(scope, { limit = 20, category = null } = {}) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const actionFilter = Prisma.sql`AND al.action_type IN (${Prisma.join(
    LIVE_ACTIVITY_ACTIONS.map((a) => Prisma.sql`${a}`)
  )})`;

  const rows = await prisma.$queryRaw`
    SELECT al.id, al.action_type, al.entity_type, al.entity_id, al.created_at, al.user_id,
           u.full_name AS user_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
      ${actionFilter}
      ${scopeAuditSql(scope)}
    ORDER BY al.created_at DESC
    LIMIT ${take}
  `;

  const items = rows.map((row) => {
    const human = humanizeAction(row);
    return {
      id: row.id,
      at: row.created_at,
      userName: row.user_name || null,
      action: human.title,
      description: human.description,
      category: human.category,
      entityType: row.entity_type,
      entityId: row.entity_id,
      href: entityHref(row),
    };
  }).filter((item) => {
    if (!category || category === 'all') return true;
    return String(item.category || '').toLowerCase() === String(category).toLowerCase();
  });

  return { items, limit: take };
}

async function getActivityHeatmap(scope, period) {
  const rows = await prisma.$queryRaw`
    SELECT
      EXTRACT(DOW FROM (al.created_at AT TIME ZONE 'Asia/Amman'))::int AS dow,
      FLOOR(EXTRACT(HOUR FROM (al.created_at AT TIME ZONE 'Asia/Amman')) / 2)::int AS hour_bucket,
      COUNT(*)::int AS events
    FROM audit_logs al
    WHERE al.created_at >= ${period.periodStart}
      AND al.created_at < ${period.periodEnd}
      ${nonMeaningfulSql}
      ${scopeAuditSql(scope)}
    GROUP BY 1, 2
  `;

  const cells = rows.map((r) => ({
    dayOfWeek: intCount(r.dow),
    hourBucket: intCount(r.hour_bucket) * 2,
    count: intCount(r.events),
  }));

  return {
    methodology: 'Meaningful audit_logs events grouped by Asia/Amman weekday and 2-hour buckets. Heartbeats and polls excluded.',
    hourBucketSize: 2,
    cells,
  };
}

async function getCurrentlyWatching(scope) {
  if (!scope.modules.recordedLectures) return 0;
  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_SECONDS * 1000);
  const rows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT p.student_id)::int AS c
    FROM field_training_recorded_lecture_progress p
    JOIN field_training_recorded_lectures l ON l.id = p.lecture_id
    JOIN field_training_opportunities o ON o.id = l.opportunity_id
    WHERE p.last_watched_at >= ${cutoff}
      AND p.completed_at IS NULL
      ${scope.opportunityId ? Prisma.sql`AND o.id = ${scope.opportunityId}::uuid` : Prisma.empty}
      ${scope.universityId ? Prisma.sql`AND (
        o.university_id = ${scope.universityId}::uuid
        OR EXISTS (
          SELECT 1 FROM field_training_opportunity_eligibility e
          WHERE e.opportunity_id = o.id AND e.university_id = ${scope.universityId}::uuid AND e.is_active = true
        )
      )` : Prisma.empty}
  `;
  return intCount(rows[0]?.c);
}

module.exports = {
  getLiveActivity,
  getActivityHeatmap,
  getCurrentlyWatching,
  humanizeAction,
};
