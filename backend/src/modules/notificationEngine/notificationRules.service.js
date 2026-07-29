'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { getEventMeta } = require('./notificationEvents.catalog');
const {
  assertNotificationAdmin,
  assertTargetUniversitiesInScope,
  assertTargetUniversityInScope,
  assertTemplatesUseAllowedVars,
  renderTemplate,
  sanitizeTemplateVars,
  isSystemWideAdmin,
  getTargetUniversityIdsFromScope,
  toTargetScope,
} = require('./notificationEngine.shared');
const { invalidateRulesCache, emitDomainEvent } = require('./notificationDispatcher.service');
const { resolveRecipients } = require('./recipientResolver.service');

function actorId(user) {
  return user?.userId || user?.id || null;
}

function mapRule(row) {
  if (!row) return null;
  const targetUniversityIds = getTargetUniversityIdsFromScope(row.target_scope);
  return {
    id: row.id,
    name_ar: row.name_ar,
    event_type: row.event_type,
    status: row.status,
    category: row.category,
    priority: row.priority,
    target_roles: row.target_roles || [],
    target_scope: row.target_scope ?? null,
    target_university_ids: targetUniversityIds,
    channels: row.channels || [],
    is_critical: row.is_critical,
    requires_acknowledgement: row.requires_acknowledgement,
    is_immediate: row.is_immediate,
    aggregation_mode: row.aggregation_mode,
    user_can_disable: row.user_can_disable,
    delay_seconds: row.delay_seconds,
    extra_conditions: row.extra_conditions ?? null,
    version: row.version ?? 1,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    published_by_id: row.published_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    templates: Array.isArray(row.notification_templates)
      ? row.notification_templates.map(mapTemplate)
      : undefined,
  };
}

function mapTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    rule_id: row.rule_id,
    role_code: row.role_code,
    channel: row.channel,
    title_template: row.title_template,
    body_template: row.body_template,
    action_label_template: row.action_label_template,
    action_url_template: row.action_url_template,
    locale: row.locale,
    version: row.version,
    status: row.status,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Scope rule list for non–system-wide admins to their university (or global rules).
 * Global = null / empty target_scope.university_ids.
 * @param {object} user
 * @returns {object}
 */
function ruleScopeWhere(user) {
  if (isSystemWideAdmin(user)) return {};
  const uni = user?.universityId ? String(user.universityId) : null;
  const globalScope = {
    OR: [
      { target_scope: { equals: Prisma.DbNull } },
      { target_scope: { equals: Prisma.JsonNull } },
      { target_scope: { equals: {} } },
      { target_scope: { equals: { university_ids: [] } } },
    ],
  };
  if (!uni) return globalScope;
  return {
    OR: [
      ...globalScope.OR,
      { target_scope: { path: ['university_ids'], array_contains: uni } },
    ],
  };
}

async function listRules(user, query = {}) {
  assertNotificationAdmin(user);
  const and = [ruleScopeWhere(user)];
  if (query.event_type) and.push({ event_type: query.event_type });
  if (query.status) and.push({ status: query.status });
  if (query.category) and.push({ category: query.category });
  if (query.q) {
    and.push({
      OR: [
        { name_ar: { contains: query.q, mode: 'insensitive' } },
        { event_type: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  const where = { AND: and };

  const [total, rows] = await Promise.all([
    prisma.notification_rules.count({ where }),
    prisma.notification_rules.findMany({
      where,
      include: { notification_templates: true },
      orderBy: [{ updated_at: 'desc' }],
      skip: query.skip || 0,
      take: query.take || 20,
    }),
  ]);

  return {
    rules: rows.map(mapRule),
    meta: {
      page: query.page || 1,
      page_size: query.page_size || 20,
      total,
      total_pages: Math.max(1, Math.ceil(total / (query.page_size || 20))),
    },
  };
}

async function getRule(user, id) {
  assertNotificationAdmin(user);
  const row = await prisma.notification_rules.findFirst({
    where: { id, ...ruleScopeWhere(user) },
    include: { notification_templates: true },
  });
  if (!row) throw new ApiError(404, 'قاعدة الإشعار غير موجودة', null, 'NOTIFICATION_RULE_NOT_FOUND');
  return { rule: mapRule(row) };
}

async function createRule(user, body) {
  assertNotificationAdmin(user);
  assertTargetUniversitiesInScope(user, body.target_university_ids);

  const meta = getEventMeta(body.event_type);
  const category = body.category || meta?.category || 'SYSTEM';
  const priority = body.priority || meta?.priority || 'NORMAL';

  const row = await prisma.notification_rules.create({
    data: {
      name_ar: body.name_ar,
      event_type: body.event_type,
      status: body.status || 'DRAFT',
      category,
      priority,
      target_roles: body.target_roles || [],
      target_scope: toTargetScope(body.target_university_ids),
      channels: body.channels || ['IN_APP', 'NOTIFICATION_CENTER', 'BELL'],
      is_critical: body.is_critical ?? Boolean(meta?.isCritical),
      requires_acknowledgement:
        body.requires_acknowledgement ?? Boolean(meta?.requiresAcknowledgement),
      is_immediate: body.is_immediate ?? true,
      aggregation_mode: body.aggregation_mode || 'NONE',
      user_can_disable: body.user_can_disable ?? true,
      delay_seconds: body.delay_seconds ?? 0,
      extra_conditions: body.extra_conditions ?? null,
      created_by_id: actorId(user),
      updated_by_id: actorId(user),
    },
    include: { notification_templates: true },
  });

  invalidateRulesCache();
  await recordAudit({
    userId: actorId(user),
    universityId: user?.universityId || null,
    actionType: 'NOTIFICATION_RULE_CREATED',
    entityType: 'notification_rules',
    entityId: row.id,
    newValues: { event_type: row.event_type, status: row.status },
  });

  return { rule: mapRule(row) };
}

async function updateRule(user, id, body) {
  assertNotificationAdmin(user);
  const existing = await prisma.notification_rules.findFirst({
    where: { id, ...ruleScopeWhere(user) },
  });
  if (!existing) throw new ApiError(404, 'قاعدة الإشعار غير موجودة', null, 'NOTIFICATION_RULE_NOT_FOUND');
  if (body.target_university_ids) {
    assertTargetUniversitiesInScope(user, body.target_university_ids);
  }

  const row = await prisma.notification_rules.update({
    where: { id },
    data: {
      ...(body.name_ar != null ? { name_ar: body.name_ar } : {}),
      ...(body.event_type ? { event_type: body.event_type } : {}),
      ...(body.category ? { category: body.category } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
      ...(body.target_roles ? { target_roles: body.target_roles } : {}),
      ...(body.target_university_ids
        ? { target_scope: toTargetScope(body.target_university_ids) }
        : {}),
      ...(body.channels ? { channels: body.channels } : {}),
      ...(body.is_critical != null ? { is_critical: body.is_critical } : {}),
      ...(body.requires_acknowledgement != null
        ? { requires_acknowledgement: body.requires_acknowledgement }
        : {}),
      ...(body.is_immediate != null ? { is_immediate: body.is_immediate } : {}),
      ...(body.aggregation_mode ? { aggregation_mode: body.aggregation_mode } : {}),
      ...(body.user_can_disable != null ? { user_can_disable: body.user_can_disable } : {}),
      ...(body.delay_seconds != null ? { delay_seconds: body.delay_seconds } : {}),
      ...(body.extra_conditions !== undefined ? { extra_conditions: body.extra_conditions } : {}),
      ...(body.status ? { status: body.status } : {}),
      version: { increment: 1 },
      updated_by_id: actorId(user),
      updated_at: new Date(),
    },
    include: { notification_templates: true },
  });

  invalidateRulesCache();
  await recordAudit({
    userId: actorId(user),
    universityId: user?.universityId || null,
    actionType: 'NOTIFICATION_RULE_UPDATED',
    entityType: 'notification_rules',
    entityId: row.id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
  });

  return { rule: mapRule(row) };
}

async function setRuleStatus(user, id, status) {
  assertNotificationAdmin(user);
  const existing = await prisma.notification_rules.findFirst({
    where: { id, ...ruleScopeWhere(user) },
  });
  if (!existing) throw new ApiError(404, 'قاعدة الإشعار غير موجودة', null, 'NOTIFICATION_RULE_NOT_FOUND');

  const data = {
    status,
    updated_by_id: actorId(user),
    updated_at: new Date(),
  };
  if (status === 'ACTIVE') {
    data.published_by_id = actorId(user);
    data.published_at = new Date();
  }

  const row = await prisma.notification_rules.update({
    where: { id },
    data,
    include: { notification_templates: true },
  });
  invalidateRulesCache();

  await recordAudit({
    userId: actorId(user),
    universityId: user?.universityId || null,
    actionType: `NOTIFICATION_RULE_${status}`,
    entityType: 'notification_rules',
    entityId: row.id,
    oldValues: { status: existing.status },
    newValues: { status },
  });

  return { rule: mapRule(row) };
}

async function activateRule(user, id) {
  return setRuleStatus(user, id, 'ACTIVE');
}

async function pauseRule(user, id) {
  return setRuleStatus(user, id, 'PAUSED');
}

async function archiveRule(user, id) {
  return setRuleStatus(user, id, 'ARCHIVED');
}

/* ---- Templates ---- */

async function listTemplates(user, query = {}) {
  assertNotificationAdmin(user);
  const where = {
    ...(query.rule_id ? { rule_id: query.rule_id } : {}),
    ...(query.role_code ? { role_code: query.role_code } : {}),
    ...(query.channel ? { channel: query.channel } : {}),
    notification_rules: ruleScopeWhere(user),
  };
  const [total, rows] = await Promise.all([
    prisma.notification_templates.count({ where }),
    prisma.notification_templates.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: query.skip || 0,
      take: query.take || 50,
    }),
  ]);
  return {
    templates: rows.map(mapTemplate),
    meta: {
      page: query.page || 1,
      page_size: query.page_size || 50,
      total,
      total_pages: Math.max(1, Math.ceil(total / (query.page_size || 50))),
    },
  };
}

async function createTemplate(user, body) {
  assertNotificationAdmin(user);
  assertTemplatesUseAllowedVars(body);

  const rule = await prisma.notification_rules.findFirst({
    where: { id: body.rule_id, ...ruleScopeWhere(user) },
  });
  if (!rule) throw new ApiError(404, 'قاعدة الإشعار غير موجودة', null, 'NOTIFICATION_RULE_NOT_FOUND');

  try {
    const row = await prisma.notification_templates.create({
      data: {
        rule_id: body.rule_id,
        role_code: body.role_code,
        channel: body.channel || 'IN_APP',
        title_template: body.title_template,
        body_template: body.body_template,
        action_label_template: body.action_label_template || null,
        action_url_template: body.action_url_template || null,
        locale: body.locale || 'ar',
        status: body.status || 'ACTIVE',
        created_by_id: actorId(user),
        updated_by_id: actorId(user),
      },
    });
    invalidateRulesCache();
    await recordAudit({
      userId: actorId(user),
      universityId: user?.universityId || null,
      actionType: 'NOTIFICATION_TEMPLATE_CREATED',
      entityType: 'notification_templates',
      entityId: row.id,
      newValues: { rule_id: row.rule_id, role_code: row.role_code, channel: row.channel },
    });
    return { template: mapTemplate(row) };
  } catch (err) {
    if (err?.code === 'P2002') {
      throw new ApiError(
        409,
        'يوجد قالب لنفس الدور والقناة واللغة',
        null,
        'NOTIFICATION_TEMPLATE_DUPLICATE'
      );
    }
    throw err;
  }
}

async function updateTemplate(user, id, body) {
  assertNotificationAdmin(user);
  if (
    body.title_template != null ||
    body.body_template != null ||
    body.action_label_template !== undefined ||
    body.action_url_template !== undefined
  ) {
    const existing = await prisma.notification_templates.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, 'قالب الإشعار غير موجود', null, 'NOTIFICATION_TEMPLATE_NOT_FOUND');
    }
    assertTemplatesUseAllowedVars({
      title_template: body.title_template ?? existing.title_template,
      body_template: body.body_template ?? existing.body_template,
      action_label_template:
        body.action_label_template !== undefined
          ? body.action_label_template
          : existing.action_label_template,
      action_url_template:
        body.action_url_template !== undefined
          ? body.action_url_template
          : existing.action_url_template,
    });
  }

  const existing = await prisma.notification_templates.findFirst({
    where: { id, notification_rules: ruleScopeWhere(user) },
  });
  if (!existing) {
    throw new ApiError(404, 'قالب الإشعار غير موجود', null, 'NOTIFICATION_TEMPLATE_NOT_FOUND');
  }

  const row = await prisma.notification_templates.update({
    where: { id },
    data: {
      ...(body.role_code ? { role_code: body.role_code } : {}),
      ...(body.channel ? { channel: body.channel } : {}),
      ...(body.title_template != null ? { title_template: body.title_template } : {}),
      ...(body.body_template != null ? { body_template: body.body_template } : {}),
      ...(body.action_label_template !== undefined
        ? { action_label_template: body.action_label_template }
        : {}),
      ...(body.action_url_template !== undefined
        ? { action_url_template: body.action_url_template }
        : {}),
      ...(body.locale ? { locale: body.locale } : {}),
      ...(body.status ? { status: body.status } : {}),
      version: { increment: 1 },
      updated_by_id: actorId(user),
      updated_at: new Date(),
    },
  });
  invalidateRulesCache();
  return { template: mapTemplate(row) };
}

/**
 * Preview rendered template — never sends a notification.
 */
async function previewTemplate(user, body) {
  assertNotificationAdmin(user);
  assertTemplatesUseAllowedVars(body);
  const vars = sanitizeTemplateVars(body.vars || {});
  return {
    preview: {
      title: renderTemplate(body.title_template, vars, { missingFallback: '-' }),
      body: renderTemplate(body.body_template, vars, { missingFallback: '-' }),
      action_label: body.action_label_template
        ? renderTemplate(body.action_label_template, vars, { missingFallback: '-' })
        : null,
      action_url: body.action_url_template
        ? renderTemplate(body.action_url_template, vars, { missingFallback: '-' })
        : null,
    },
  };
}

/* ---- Deliveries / ops ---- */

async function listDeliveries(user, query = {}) {
  assertNotificationAdmin(user);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.channel ? { channel: query.channel } : {}),
    ...(query.failures_only ? { status: 'FAILED' } : {}),
    ...(query.event_type
      ? { notifications: { event_type: query.event_type } }
      : {}),
  };

  if (!isSystemWideAdmin(user) && user?.universityId) {
    where.notifications = {
      ...(where.notifications || {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.notification_deliveries.count({ where }),
    prisma.notification_deliveries.findMany({
      where,
      include: {
        notifications: {
          select: {
            id: true,
            user_id: true,
            title: true,
            event_type: true,
            category: true,
            priority: true,
            actor_id: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: query.skip || 0,
      take: query.take || 50,
    }),
  ]);

  return {
    deliveries: rows.map((d) => ({
      id: d.id,
      notification_id: d.notification_id,
      channel: d.channel,
      status: d.status,
      attempt_count: d.attempt_count,
      sent_at: d.sent_at,
      delivered_at: d.delivered_at,
      failed_at: d.failed_at,
      next_retry_at: d.next_retry_at,
      failure_code: d.failure_code,
      failure_message_safe: d.failure_message_safe,
      created_at: d.created_at,
      notification: d.notifications,
    })),
    meta: {
      page: query.page || 1,
      page_size: query.page_size || 50,
      total,
      total_pages: Math.max(1, Math.ceil(total / (query.page_size || 50))),
    },
  };
}

async function listFailures(user, query = {}) {
  return listDeliveries(user, { ...query, failures_only: true, status: 'FAILED' });
}

async function retryDelivery(user, id) {
  assertNotificationAdmin(user);
  const delivery = await prisma.notification_deliveries.findUnique({
    where: { id },
    include: { notifications: true },
  });
  if (!delivery) {
    throw new ApiError(404, 'سجل التسليم غير موجود', null, 'NOTIFICATION_DELIVERY_NOT_FOUND');
  }
  if (!['FAILED', 'SKIPPED', 'PENDING'].includes(delivery.status)) {
    throw new ApiError(400, 'لا يمكن إعادة محاولة هذا التسليم', null, 'DELIVERY_NOT_RETRYABLE');
  }

  const updated = await prisma.notification_deliveries.update({
    where: { id },
    data: {
      status: 'PENDING',
      failure_code: null,
      failure_message_safe: null,
      failed_at: null,
      next_retry_at: null,
      attempt_count: { increment: 1 },
      updated_at: new Date(),
    },
  });

  // Best-effort re-fanout for PUSH
  if (delivery.channel === 'PUSH' && delivery.notifications) {
    setImmediate(() => {
      try {
        const push = require('../../services/pushNotification.service');
        const n = delivery.notifications;
        push
          .sendToUser(n.user_id, {
            notificationId: n.id,
            title: n.title,
            body: n.body,
            actionUrl: n.action_url,
            type: n.type,
          })
          .then(async (result) => {
            await prisma.notification_deliveries.update({
              where: { id },
              data: {
                status: result?.skipped ? 'SKIPPED' : 'SENT',
                sent_at: new Date(),
                updated_at: new Date(),
                failure_message_safe: result?.skipped
                  ? 'تعذر إرسال الإشعار الفوري حالياً'
                  : null,
              },
            });
          })
          .catch(async () => {
            await prisma.notification_deliveries.update({
              where: { id },
              data: {
                status: 'FAILED',
                failed_at: new Date(),
                next_retry_at: new Date(Date.now() + 5 * 60 * 1000),
                failure_code: 'PUSH_RETRY_FAILED',
                failure_message_safe: 'تعذر إرسال الإشعار الفوري',
                updated_at: new Date(),
              },
            });
          });
      } catch (_err) {
        // ignore
      }
    });
  } else if (delivery.channel === 'IN_APP') {
    await prisma.notification_deliveries.update({
      where: { id },
      data: { status: 'SENT', sent_at: new Date(), updated_at: new Date() },
    });
  } else {
    await prisma.notification_deliveries.update({
      where: { id },
      data: {
        status: 'SKIPPED',
        failure_code: 'RETRY_UNSUPPORTED',
        failure_message_safe: 'إعادة المحاولة غير مدعومة لهذه القناة حالياً',
        updated_at: new Date(),
      },
    });
  }

  await recordAudit({
    userId: actorId(user),
    universityId: user?.universityId || null,
    actionType: 'NOTIFICATION_DELIVERY_RETRY',
    entityType: 'notification_deliveries',
    entityId: id,
  });

  return { delivery: updated };
}

async function getAnalytics(user, query = {}) {
  assertNotificationAdmin(user);
  if (query.university_id) {
    assertTargetUniversityInScope(user, query.university_id);
  }

  const createdAtFilter = {};
  if (query.from) createdAtFilter.gte = new Date(query.from);
  if (query.to) createdAtFilter.lte = new Date(query.to);

  const notifWhere = {
    ...(Object.keys(createdAtFilter).length ? { created_at: createdAtFilter } : {}),
    ...(query.event_type ? { event_type: query.event_type } : {}),
    ...(query.category ? { category: query.category } : {}),
  };

  const [total, unread, critical, byCategory, byPriority, failedDeliveries, sentDeliveries] =
    await Promise.all([
      prisma.notifications.count({ where: notifWhere }),
      prisma.notifications.count({ where: { ...notifWhere, is_read: false } }),
      prisma.notifications.count({ where: { ...notifWhere, is_critical: true } }),
      prisma.notifications.groupBy({
        by: ['category'],
        where: notifWhere,
        _count: { _all: true },
      }),
      prisma.notifications.groupBy({
        by: ['priority'],
        where: notifWhere,
        _count: { _all: true },
      }),
      prisma.notification_deliveries.count({
        where: {
          status: 'FAILED',
          ...(Object.keys(createdAtFilter).length ? { created_at: createdAtFilter } : {}),
        },
      }),
      prisma.notification_deliveries.count({
        where: {
          status: { in: ['SENT', 'DELIVERED', 'READ'] },
          ...(Object.keys(createdAtFilter).length ? { created_at: createdAtFilter } : {}),
        },
      }),
    ]);

  return {
    analytics: {
      total_notifications: total,
      unread,
      critical,
      failed_deliveries: failedDeliveries,
      successful_deliveries: sentDeliveries,
      by_category: byCategory.map((r) => ({
        category: r.category,
        count: r._count._all,
      })),
      by_priority: byPriority.map((r) => ({
        priority: r.priority,
        count: r._count._all,
      })),
      scoped_university_id: isSystemWideAdmin(user)
        ? query.university_id || null
        : user?.universityId || null,
    },
  };
}

/**
 * Manual admin send / dry-run recipient preview.
 * Never trusts client recipientIds — resolves via engine.
 */
async function manualSend(user, body) {
  assertNotificationAdmin(user);
  if (body.university_id) assertTargetUniversityInScope(user, body.university_id);

  const context = {
    universityId: body.university_id || user?.universityId || null,
    opportunityId: body.opportunity_id || null,
    studentId: body.student_id || null,
    instructorId: body.instructor_id || null,
    title: body.title,
    body: body.body,
    actionUrl: body.action_url,
    actionLabel: body.action_label,
    templateVars: sanitizeTemplateVars(body.vars || {}),
    entityType: 'manual',
    entityId: null,
    actorUserId: actorId(user),
  };

  let recipients = await resolveRecipients(body.event_type, context);
  if (Array.isArray(body.target_roles) && body.target_roles.length) {
    const allowed = new Set(body.target_roles.map((r) => String(r).toLowerCase()));
    recipients = recipients.filter((r) => allowed.has(String(r.roleCode).toLowerCase()));
  }

  if (body.dry_run) {
    return {
      dry_run: true,
      recipient_count: recipients.length,
      recipients: recipients.map((r) => ({ user_id: r.userId, role_code: r.roleCode })),
    };
  }

  const emitResult = await emitDomainEvent(body.event_type, context);
  if (emitResult.created > 0 || emitResult.reason === 'UNKNOWN_EVENT') {
    await recordAudit({
      userId: actorId(user),
      universityId: body.university_id || user?.universityId || null,
      actionType: 'NOTIFICATION_MANUAL_SEND',
      entityType: 'notifications',
      newValues: {
        event_type: body.event_type,
        created: emitResult.created,
        recipient_count: recipients.length,
      },
    });
    return {
      dry_run: false,
      recipient_count: recipients.length,
      ...emitResult,
    };
  }

  // No active rules: create direct in-app notifications for previewed recipients
  let created = 0;
  for (const r of recipients) {
    try {
      await prisma.notifications.create({
        data: {
          user_id: r.userId,
          title: body.title,
          body: body.body || null,
          type: 'system',
          action_url: body.action_url || null,
          action_label: body.action_label || null,
          event_type: body.event_type,
          category: getEventMeta(body.event_type)?.category || 'SYSTEM',
          priority: getEventMeta(body.event_type)?.priority || 'NORMAL',
          is_critical: Boolean(getEventMeta(body.event_type)?.isCritical),
          actor_id: actorId(user),
        },
      });
      created += 1;
    } catch (_err) {
      // skip individual failures
    }
  }

  await recordAudit({
    userId: actorId(user),
    universityId: body.university_id || user?.universityId || null,
    actionType: 'NOTIFICATION_MANUAL_SEND',
    entityType: 'notifications',
    newValues: {
      event_type: body.event_type,
      created,
      recipient_count: recipients.length,
      mode: 'direct',
    },
  });

  return {
    dry_run: false,
    recipient_count: recipients.length,
    created,
    skipped: Math.max(0, recipients.length - created),
    deliveries: created,
    mode: 'direct',
  };
}

async function previewManualRecipients(user, body) {
  return manualSend(user, { ...body, dry_run: true });
}

module.exports = {
  listRules,
  getRule,
  createRule,
  updateRule,
  activateRule,
  pauseRule,
  archiveRule,
  listTemplates,
  createTemplate,
  updateTemplate,
  previewTemplate,
  listDeliveries,
  listFailures,
  retryDelivery,
  getAnalytics,
  manualSend,
  previewManualRecipients,
  mapRule,
  mapTemplate,
};
