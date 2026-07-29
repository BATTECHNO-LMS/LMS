'use strict';

/**
 * Idempotent seed for notification rules + templates (system-like ACTIVE defaults).
 * Upserts by (event_type + name_ar). Safe to re-run.
 *
 * Usage: node scripts/seed-notification-rules.js
 */
const { prisma } = require('../src/config/db');
const { invalidateRulesCache } = require('../src/modules/notificationEngine/notificationDispatcher.service');

const NOW = () => new Date();

/**
 * @typedef {{
 *   name_ar: string,
 *   event_type: string,
 *   category: string,
 *   priority?: string,
 *   target_roles: string[],
 *   channels?: string[],
 *   is_critical?: boolean,
 *   requires_acknowledgement?: boolean,
 *   user_can_disable?: boolean,
 *   templates: Array<{
 *     role_code: string,
 *     channel?: string,
 *     title_template: string,
 *     body_template: string,
 *     action_label_template?: string | null,
 *     action_url_template?: string | null,
 *   }>,
 * }} SeedRule
 */

/** @type {SeedRule[]} */
const SEED_RULES = [
  {
    name_ar: 'حساب بانتظار التفعيل',
    event_type: 'ACCOUNT_PENDING_ACTIVATION',
    category: 'ACCOUNT',
    priority: 'HIGH',
    target_roles: ['student'],
    is_critical: true,
    user_can_disable: false,
    templates: [
      {
        role_code: 'student',
        title_template: 'حسابك بانتظار التفعيل',
        body_template:
          'مرحباً {{student_name}}، تم استلام طلب التسجيل. سيُفعّل حسابك بعد مراجعة الإدارة.',
        action_label_template: 'متابعة الحالة',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'تأخير تفعيل الحساب',
    event_type: 'ACCOUNT_ACTIVATION_DELAYED',
    category: 'ACCOUNT',
    priority: 'HIGH',
    target_roles: ['student', 'admin'],
    is_critical: true,
    user_can_disable: false,
    templates: [
      {
        role_code: 'student',
        title_template: 'تأخير في تفعيل حسابك',
        body_template:
          'مرحباً {{student_name}}، ما زال حسابك بانتظار التفعيل منذ {{activation_wait_hours}} ساعة. نعمل على مراجعته.',
        action_label_template: 'فتح المنصة',
        action_url_template: '/login/student',
      },
      {
        role_code: 'admin',
        title_template: 'حساب طالب بانتظار التفعيل',
        body_template:
          'الطالب {{student_name}} ({{email}}) ما زال بانتظار التفعيل منذ {{activation_wait_hours}} ساعة.',
        action_label_template: 'مراجعة الحسابات',
        action_url_template: '/admin/users?status=inactive',
      },
    ],
  },
  {
    name_ar: 'تم تفعيل الحساب',
    event_type: 'ACCOUNT_ACTIVATED',
    category: 'ACCOUNT',
    priority: 'HIGH',
    target_roles: ['student'],
    is_critical: true,
    user_can_disable: false,
    templates: [
      {
        role_code: 'student',
        title_template: 'تم تفعيل حسابك',
        body_template:
          'مرحباً {{student_name}}، تم تفعيل حسابك. يمكنك الآن تسجيل الدخول إلى منصة التدريب الميداني.',
        action_label_template: 'تسجيل الدخول',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'فتح نافذة الحضور',
    event_type: 'ATTENDANCE_WINDOW_OPENED',
    category: 'ATTENDANCE',
    priority: 'URGENT',
    target_roles: ['student'],
    is_critical: true,
    user_can_disable: false,
    templates: [
      {
        role_code: 'student',
        title_template: 'نافذة الحضور مفتوحة الآن',
        body_template:
          'جلسة «{{session_title}}» في فرصة «{{opportunity_name}}»: نافذة تسجيل الحضور مفتوحة. سجّل حضورك الآن عبر الرمز الذي يعلنه المدرس.',
        action_label_template: 'تسجيل الحضور',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'تم تسليم مهمة',
    event_type: 'TASK_SUBMITTED',
    category: 'TASK',
    priority: 'NORMAL',
    target_roles: ['student', 'instructor'],
    templates: [
      {
        role_code: 'student',
        title_template: 'تم استلام تسليمك',
        body_template: 'تم استلام تسليمك لمهمة «{{task_title}}» بنجاح.',
        action_label_template: 'عرض المهمة',
        action_url_template: '{{action_url}}',
      },
      {
        role_code: 'instructor',
        title_template: 'تسليم مهمة جديد',
        body_template: 'قدّم الطالب {{student_name}} تسليمًا لمهمة «{{task_title}}».',
        action_label_template: 'مراجعة التسليم',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'نشر مهمة جديدة',
    event_type: 'TASK_PUBLISHED',
    category: 'TASK',
    priority: 'NORMAL',
    target_roles: ['student'],
    templates: [
      {
        role_code: 'student',
        title_template: 'مهمة جديدة متاحة',
        body_template:
          'تم نشر مهمة «{{task_title}}» في فرصة «{{opportunity_name}}». الموعد النهائي: {{deadline}}.',
        action_label_template: 'عرض المهمة',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'إنشاء جلسة تدريبية',
    event_type: 'SESSION_CREATED',
    category: 'SESSION',
    priority: 'NORMAL',
    target_roles: ['student', 'instructor', 'admin'],
    templates: [
      {
        role_code: 'student',
        title_template: 'جلسة جديدة في جدولك',
        body_template:
          'تمت إضافة جلسة «{{session_title}}» لفرصة «{{opportunity_name}}» بتاريخ {{session_date}} الساعة {{session_time}}.',
        action_label_template: 'عرض الجلسة',
        action_url_template: '{{action_url}}',
      },
      {
        role_code: 'instructor',
        title_template: 'جلسة جديدة',
        body_template:
          'تم إنشاء جلسة «{{session_title}}» لفرصة «{{opportunity_name}}» بتاريخ {{session_date}}.',
        action_label_template: 'إدارة الجلسة',
        action_url_template: '{{action_url}}',
      },
      {
        role_code: 'admin',
        title_template: 'جلسة تدريبية جديدة',
        body_template:
          'تم إنشاء جلسة «{{session_title}}» في فرصة «{{opportunity_name}}» ({{university_name}}).',
        action_label_template: 'عرض التفاصيل',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'قبول طلب التدريب',
    event_type: 'APPLICATION_ACCEPTED',
    category: 'APPLICATION',
    priority: 'HIGH',
    target_roles: ['student'],
    is_critical: true,
    templates: [
      {
        role_code: 'student',
        title_template: 'تم قبول طلبك',
        body_template:
          'تهانينا {{student_name}}! تم قبول طلبك لفرصة «{{opportunity_name}}».',
        action_label_template: 'عرض الفرصة',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'رفض طلب التدريب',
    event_type: 'APPLICATION_REJECTED',
    category: 'APPLICATION',
    priority: 'HIGH',
    target_roles: ['student'],
    is_critical: true,
    templates: [
      {
        role_code: 'student',
        title_template: 'تم رفض طلبك',
        body_template:
          'عذراً {{student_name}}، لم يتم قبول طلبك لفرصة «{{opportunity_name}}». يمكنك التقديم على فرص أخرى.',
        action_label_template: 'استعراض الفرص',
        action_url_template: '{{action_url}}',
      },
    ],
  },
  {
    name_ar: 'إصدار شهادة',
    event_type: 'CERTIFICATE_ISSUED',
    category: 'CERTIFICATE',
    priority: 'HIGH',
    target_roles: ['student', 'reviewer'],
    templates: [
      {
        role_code: 'student',
        title_template: 'تم إصدار شهادتك',
        body_template:
          'تم إصدار شهادة «{{certificate_name}}». يمكنك عرضها وتنزيلها من حسابك.',
        action_label_template: 'عرض الشهادة',
        action_url_template: '/student/certificates/{{entity_id}}',
      },
      {
        role_code: 'reviewer',
        title_template: 'شهادة صادرة (عرض فقط)',
        body_template:
          'تم إصدار شهادة «{{certificate_name}}» للطالب {{student_name}}. الرابط للقراءة فقط.',
        action_label_template: 'عرض الشهادة',
        action_url_template: '/reviewer/certificates/{{entity_id}}',
      },
    ],
  },
];

/**
 * @param {SeedRule} seed
 */
async function upsertRule(seed) {
  const existing = await prisma.notification_rules.findFirst({
    where: {
      event_type: seed.event_type,
      name_ar: seed.name_ar,
    },
    include: { notification_templates: true },
  });

  const ruleData = {
    name_ar: seed.name_ar,
    event_type: seed.event_type,
    status: 'ACTIVE',
    category: seed.category,
    priority: seed.priority || 'NORMAL',
    target_roles: seed.target_roles,
    target_scope: null,
    channels: seed.channels || ['IN_APP', 'NOTIFICATION_CENTER', 'BELL'],
    is_critical: Boolean(seed.is_critical),
    requires_acknowledgement: Boolean(seed.requires_acknowledgement),
    is_immediate: true,
    aggregation_mode: 'NONE',
    user_can_disable: seed.user_can_disable !== false,
    delay_seconds: 0,
    extra_conditions: null,
    published_at: NOW(),
    updated_at: NOW(),
  };

  let rule;
  if (existing) {
    rule = await prisma.notification_rules.update({
      where: { id: existing.id },
      data: {
        ...ruleData,
        version: { increment: 1 },
      },
      include: { notification_templates: true },
    });
  } else {
    rule = await prisma.notification_rules.create({
      data: {
        ...ruleData,
        version: 1,
      },
      include: { notification_templates: true },
    });
  }

  for (const tpl of seed.templates) {
    const channel = tpl.channel || 'IN_APP';
    const locale = 'ar';
    const existingTpl = await prisma.notification_templates.findFirst({
      where: {
        rule_id: rule.id,
        role_code: tpl.role_code,
        channel,
        locale,
      },
    });

    const tplData = {
      role_code: tpl.role_code,
      channel,
      title_template: tpl.title_template,
      body_template: tpl.body_template,
      action_label_template: tpl.action_label_template || null,
      action_url_template: tpl.action_url_template || null,
      locale,
      status: 'ACTIVE',
      updated_at: NOW(),
    };

    if (existingTpl) {
      await prisma.notification_templates.update({
        where: { id: existingTpl.id },
        data: {
          ...tplData,
          version: { increment: 1 },
        },
      });
    } else {
      await prisma.notification_templates.create({
        data: {
          rule_id: rule.id,
          ...tplData,
          version: 1,
        },
      });
    }
  }

  return { event_type: seed.event_type, name_ar: seed.name_ar, rule_id: rule.id };
}

async function main() {
  const results = [];
  for (const seed of SEED_RULES) {
    const row = await upsertRule(seed);
    results.push(row);
    // eslint-disable-next-line no-console
    console.log(`✓ ${row.event_type} — ${row.name_ar} (${row.rule_id})`);
  }
  invalidateRulesCache();
  // eslint-disable-next-line no-console
  console.log(`\nSeeded ${results.length} notification rules.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('seed-notification-rules failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
